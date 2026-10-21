import { ModelInfo, ProviderAdapter } from "../types"
import { streamSSE } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

// Popular subset - OpenRouter has 100s more; users can type arbitrary model IDs
const OPENROUTER_MODELS: ModelInfo[] = [
  { id: "openai/gpt-4o", name: "OpenAI GPT-4o", contextWindow: 128000, supportsStreaming: true },
  { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o mini", contextWindow: 128000, supportsStreaming: true },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", contextWindow: 200000, supportsStreaming: true },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", contextWindow: 200000, supportsStreaming: true },
  { id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", contextWindow: 1_048_576, supportsStreaming: true },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", contextWindow: 128000, supportsStreaming: true },
  { id: "mistralai/mistral-large", name: "Mistral Large", contextWindow: 128000, supportsStreaming: true },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", contextWindow: 128000, supportsStreaming: true },
]

export const openrouterAdapter: ProviderAdapter = {
  id: "openrouter",
  name: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  iconColor: "#8b5cf6",
  iconInitials: "OR",
  models: OPENROUTER_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key) {
    try {
      const res = await fetch(`${this.baseUrl}/auth/key`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (!res.ok) return { valid: false, error: `HTTP ${res.status}` }
      const data = await res.json()
      return { valid: !!data.data }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Connection failed" }
    }
  },
  async fetchModels(key, baseUrl) {
    return fetchOpenAIModels(key, baseUrl || this.baseUrl)
  },
  async *streamChat(params) {
    const { apiKey, model, messages, temperature = 0.7, maxTokens, signal, baseUrl } = params
    const res = await fetch(`${(baseUrl || this.baseUrl).replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://omniai.local",
        "X-Title": "OmniAI",
      },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        temperature,
        max_tokens: maxTokens,
      }),
      signal,
    })
    yield* streamSSE(res, (data) => {
      try {
        const j = JSON.parse(data)
        const choice = j.choices?.[0]
        const delta = choice?.delta
        if (delta?.content) return { type: "delta", content: delta.content }
        if (j.usage) {
          return {
            type: "usage",
            usage: {
              promptTokens: j.usage.prompt_tokens || 0,
              completionTokens: j.usage.completion_tokens || 0,
              totalTokens: j.usage.total_tokens || 0,
            },
          }
        }
        if (choice?.finish_reason) return { type: "done", finishReason: choice.finish_reason }
        return null
      } catch { return null }
    })
  },
  estimateCost() { return 0 },
}
