import { ModelInfo, ProviderAdapter, TokenUsage, ChatChunk } from "../types"
import { streamSSE } from "../streaming"

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: "claude-3-5-sonnet-latest", name: "Claude 3.5 Sonnet", contextWindow: 200000, maxOutputTokens: 8192, inputPricePer1M: 3, outputPricePer1M: 15, supportsVision: true, supportsStreaming: true },
  { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", contextWindow: 200000, maxOutputTokens: 8192, inputPricePer1M: 0.8, outputPricePer1M: 4, supportsVision: true, supportsStreaming: true },
  { id: "claude-3-opus-latest", name: "Claude 3 Opus", contextWindow: 200000, maxOutputTokens: 4096, inputPricePer1M: 15, outputPricePer1M: 75, supportsVision: true, supportsStreaming: true },
  { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", contextWindow: 200000, maxOutputTokens: 4096, inputPricePer1M: 0.25, outputPricePer1M: 1.25, supportsVision: true, supportsStreaming: true },
]

const API_VERSION = "2023-06-01"

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  name: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  iconColor: "#d97757",
  iconInitials: "AN",
  models: ANTHROPIC_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key) {
    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      })
      if (res.status === 401) {
        return { valid: false, error: "Invalid API key" }
      }
      // Any other response (even 400 for bad request) means key works
      return { valid: res.ok || res.status === 400 }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Connection failed" }
    }
  },
  async *streamChat(params): AsyncGenerator<ChatChunk> {
    const { apiKey, model, messages, temperature = 0.7, maxTokens = 4096, signal, baseUrl } = params
    const systemMessages = messages.filter((m) => m.role === "system")
    const nonSystem = messages.filter((m) => m.role !== "system")
    const system = systemMessages.map((m) => m.content).join("\n\n")

    const url = `${(baseUrl || this.baseUrl).replace(/\/$/, "")}/v1/messages`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        ...(system && { system }),
        messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
      }),
      signal,
    })

    let promptTokens = 0
    let completionTokens = 0

    yield* streamSSE(res, (data) => {
      try {
        const evt = JSON.parse(data)
        if (evt.type === "content_block_delta") {
          const text = evt.delta?.text
          if (text) return { type: "delta", content: text }
        }
        if (evt.type === "message_start" && evt.message?.usage) {
          promptTokens = evt.message.usage.input_tokens || 0
        }
        if (evt.type === "message_delta" && evt.usage) {
          completionTokens = evt.usage.output_tokens || 0
        }
        if (evt.type === "message_stop") {
          return {
            type: "usage",
            usage: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          }
        }
        return null
      } catch {
        return null
      }
    })
  },
  async fetchModels(apiKey, baseUrl) {
    const response = await fetch(`${(baseUrl || this.baseUrl).replace(/\/$/, "")}/v1/models?limit=1000`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
    })
    const body = await response.text()
    if (!response.ok) throw new Error(`Anthropic model list failed (HTTP ${response.status}): ${body.slice(0, 250)}`)
    const data = JSON.parse(body) as { data?: { id?: string; display_name?: string }[] }
    const models = (data.data || [])
      .filter((model): model is { id: string; display_name?: string } => typeof model.id === "string" && model.id.startsWith("claude-"))
      .map((model) => ({
        id: model.id,
        name: model.display_name || model.id,
        contextWindow: 200000,
        supportsStreaming: true,
      }))
    if (!models.length) throw new Error("Anthropic did not return any Claude models")
    return models
  },
  estimateCost(usage: TokenUsage, model: string): number {
    const m = ANTHROPIC_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
