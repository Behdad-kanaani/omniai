import { ModelInfo, ProviderAdapter, TokenUsage } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

const XAI_MODELS: ModelInfo[] = [
  { id: "grok-beta", name: "Grok Beta", contextWindow: 131072, maxOutputTokens: 4096, inputPricePer1M: 5, outputPricePer1M: 15, supportsStreaming: true },
  { id: "grok-2", name: "Grok 2", contextWindow: 131072, maxOutputTokens: 4096, inputPricePer1M: 2, outputPricePer1M: 10, supportsStreaming: true },
  { id: "grok-2-mini", name: "Grok 2 mini", contextWindow: 131072, maxOutputTokens: 4096, inputPricePer1M: 0.3, outputPricePer1M: 0.5, supportsStreaming: true },
]

export const xaiAdapter: ProviderAdapter = {
  id: "xai",
  name: "xAI Grok",
  baseUrl: "https://api.x.ai/v1",
  iconColor: "#000000",
  iconInitials: "xAI",
  models: XAI_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key, baseUrl) { return validateOpenAIKey(key, baseUrl || this.baseUrl) },
  async fetchModels(key, baseUrl) {
    return fetchOpenAIModels(key, baseUrl || this.baseUrl, (id) => id.toLowerCase().startsWith("grok"))
  },
  async *streamChat(params) { yield* streamOpenAIChat({ ...params, baseUrl: params.baseUrl || this.baseUrl }) },
  estimateCost(usage: TokenUsage, model: string) {
    const m = XAI_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
