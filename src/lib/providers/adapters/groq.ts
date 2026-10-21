import { ModelInfo, ProviderAdapter, TokenUsage } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

const GROQ_MODELS: ModelInfo[] = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", contextWindow: 128000, maxOutputTokens: 32768, inputPricePer1M: 0.59, outputPricePer1M: 0.79, supportsStreaming: true },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", contextWindow: 128000, maxOutputTokens: 8192, inputPricePer1M: 0.05, outputPricePer1M: 0.08, supportsStreaming: true },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", contextWindow: 32768, maxOutputTokens: 8192, inputPricePer1M: 0.24, outputPricePer1M: 0.24, supportsStreaming: true },
  { id: "gemma2-9b-it", name: "Gemma 2 9B", contextWindow: 8192, maxOutputTokens: 8192, inputPricePer1M: 0.2, outputPricePer1M: 0.2, supportsStreaming: true },
]

export const groqAdapter: ProviderAdapter = {
  id: "groq",
  name: "Groq",
  baseUrl: "https://api.groq.com/openai/v1",
  iconColor: "#f55036",
  iconInitials: "GQ",
  models: GROQ_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key, baseUrl) { return validateOpenAIKey(key, baseUrl || this.baseUrl) },
  async fetchModels(key, baseUrl) {
    return fetchOpenAIModels(key, baseUrl || this.baseUrl, (id) => !/(whisper|tts|moderation|embed)/i.test(id))
  },
  async *streamChat(params) { yield* streamOpenAIChat({ ...params, baseUrl: params.baseUrl || this.baseUrl }) },
  estimateCost(usage: TokenUsage, model: string) {
    const m = GROQ_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
