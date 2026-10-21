import { ModelInfo, ProviderAdapter, TokenUsage } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

const DEEPSEEK_MODELS: ModelInfo[] = [
  { id: "deepseek-chat", name: "DeepSeek Chat (V3)", contextWindow: 64000, maxOutputTokens: 8192, inputPricePer1M: 0.27, outputPricePer1M: 1.1, supportsStreaming: true },
  { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)", contextWindow: 64000, maxOutputTokens: 8192, inputPricePer1M: 0.55, outputPricePer1M: 2.19, supportsStreaming: true },
]

export const deepseekAdapter: ProviderAdapter = {
  id: "deepseek",
  name: "DeepSeek",
  baseUrl: "https://api.deepseek.com/v1",
  iconColor: "#4f46e5",
  iconInitials: "DS",
  models: DEEPSEEK_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key, baseUrl) { return validateOpenAIKey(key, baseUrl || this.baseUrl) },
  async fetchModels(key, baseUrl) {
    return fetchOpenAIModels(key, baseUrl || this.baseUrl, (id) => id.toLowerCase().includes("deepseek"))
  },
  async *streamChat(params) { yield* streamOpenAIChat({ ...params, baseUrl: params.baseUrl || this.baseUrl }) },
  estimateCost(usage: TokenUsage, model: string) {
    const m = DEEPSEEK_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
