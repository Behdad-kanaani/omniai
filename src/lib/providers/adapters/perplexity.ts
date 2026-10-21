import type { ChatChunk, ModelInfo, ProviderAdapter, TokenUsage } from "../types"
import { streamSSE } from "../streaming"

const PERPLEXITY_MODELS: ModelInfo[] = [
  { id: "perplexity/sonar", name: "Sonar", contextWindow: 127000, inputPricePer1M: 0.25, outputPricePer1M: 2.5, supportsStreaming: true },
  { id: "openai/gpt-6.1-sol", name: "GPT 6.1 Sol", contextWindow: 272000, supportsStreaming: true },
  { id: "openai/gpt-6-luna", name: "GPT 6 Luna", contextWindow: 272000, supportsStreaming: true },
  { id: "anthropic/claude-opus-5-5", name: "Claude Opus 5.5", contextWindow: 200000, supportsStreaming: true },
  { id: "anthropic/claude-sonnet-5-5", name: "Claude Sonnet 5.5", contextWindow: 200000, supportsStreaming: true },
  { id: "google/gemini-4-argon", name: "Gemini 4 Argon", contextWindow: 1000000, supportsStreaming: true },
  { id: "xai/grok-4.7", name: "Grok 4.7", contextWindow: 200000, supportsStreaming: true },
  { id: "perplexity/nemotron-3.5-super-120b-a12b", name: "Nemotron 3.5 Super", contextWindow: 1000000, supportsStreaming: true },
  { id: "perplexity/deepseek-v4-pro-0813", name: "DeepSeek V4 Pro", contextWindow: 128000, supportsStreaming: true },
  { id: "perplexity/kimi-k3", name: "Kimi K3", contextWindow: 256000, supportsStreaming: true },
]

function agentUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, "")
  return `${base.endsWith("/v1") ? base : `${base}/v1`}/agent`
}

function responseError(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { error?: string | { message?: string }; message?: string }
    if (typeof parsed.error === "string") return parsed.error
    if (parsed.error?.message) return parsed.error.message
    if (parsed.message) return parsed.message
  } catch {
  }
  return body.slice(0, 300) || `HTTP ${status}`
}

export const perplexityAdapter: ProviderAdapter = {
  id: "perplexity",
  name: "Perplexity",
  baseUrl: "https://api.perplexity.ai/v1",
  iconColor: "#20808d",
  iconInitials: "PX",
  models: PERPLEXITY_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(apiKey, baseUrl) {
    try {
      const response = await fetch(agentUrl(baseUrl || this.baseUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "perplexity/sonar",
          input: "Reply with OK.",
          max_output_tokens: 1,
        }),
      })
      if (!response.ok) return { valid: false, error: responseError(await response.text(), response.status) }
      return { valid: true }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Connection failed" }
    }
  },
  async *streamChat(params): AsyncGenerator<ChatChunk> {
    const { apiKey, model, messages, temperature = 0.7, maxTokens, signal, baseUrl } = params
    const instructions = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n")
    const input = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }))
    const response = await fetch(agentUrl(baseUrl || this.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input,
        ...(instructions && { instructions }),
        max_output_tokens: maxTokens || 4096,
        temperature,
        stream: true,
      }),
      signal,
    })

    yield* streamSSE(response, (data) => {
      const event = JSON.parse(data) as {
        type?: string
        delta?: string
        response?: {
          usage?: { input_tokens?: number; output_tokens?: number }
          error?: { message?: string }
        }
        error?: { message?: string } | string
      }
      if (event.type === "response.output_text.delta" && event.delta) {
        return { type: "delta", content: event.delta }
      }
      if (event.type === "response.completed" && event.response?.usage) {
        const promptTokens = event.response.usage.input_tokens || 0
        const completionTokens = event.response.usage.output_tokens || 0
        return { type: "usage", usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } }
      }
      if (event.type === "response.failed" || event.type === "error") {
        const error = event.response?.error?.message || (typeof event.error === "string" ? event.error : event.error?.message)
        return { type: "error", error: error || "Perplexity request failed" }
      }
      return null
    })
  },
  estimateCost(usage: TokenUsage, model: string) {
    const info = PERPLEXITY_MODELS.find((item) => item.id === model)
    if (!info?.inputPricePer1M || !info.outputPricePer1M) return 0
    return (usage.promptTokens * info.inputPricePer1M + usage.completionTokens * info.outputPricePer1M) / 1_000_000
  },
}
