import { ModelInfo, ProviderAdapter, TokenUsage } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

const MISTRAL_MODELS: ModelInfo[] = [
  { id: "mistral-large-latest", name: "Mistral Large", contextWindow: 128000, maxOutputTokens: 4096, inputPricePer1M: 2, outputPricePer1M: 6, supportsStreaming: true },
  { id: "mistral-small-latest", name: "Mistral Small", contextWindow: 128000, maxOutputTokens: 4096, inputPricePer1M: 0.2, outputPricePer1M: 0.6, supportsStreaming: true },
  { id: "codestral-latest", name: "Codestral", contextWindow: 256000, maxOutputTokens: 4096, inputPricePer1M: 0.3, outputPricePer1M: 0.9, supportsStreaming: true },
  { id: "open-mistral-nemo", name: "Mistral Nemo", contextWindow: 128000, maxOutputTokens: 4096, inputPricePer1M: 0.15, outputPricePer1M: 0.15, supportsStreaming: true },
]

export const mistralAdapter: ProviderAdapter = {
  id: "mistral",
  name: "Mistral AI",
  baseUrl: "https://api.mistral.ai/v1",
  iconColor: "#ff7000",
  iconInitials: "MI",
  models: MISTRAL_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key, baseUrl) { return validateOpenAIKey(key, baseUrl || this.baseUrl) },
  async fetchModels(key, baseUrl) {
    return fetchOpenAIModels(key, baseUrl || this.baseUrl, (id) => !/(embed|moderation)/i.test(id))
  },
  async *streamChat(params) { yield* streamOpenAIChat({ ...params, baseUrl: params.baseUrl || this.baseUrl }) },
  estimateCost(usage: TokenUsage, model: string) {
    const m = MISTRAL_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
