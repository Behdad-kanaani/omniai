import { ModelInfo, ProviderAdapter, TokenUsage } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

const OPENAI_MODELS: ModelInfo[] = [
  { id: "gpt-4o", name: "GPT-4o", contextWindow: 128000, maxOutputTokens: 16384, inputPricePer1M: 2.5, outputPricePer1M: 10, supportsVision: true, supportsStreaming: true },
  { id: "gpt-4o-mini", name: "GPT-4o mini", contextWindow: 128000, maxOutputTokens: 16384, inputPricePer1M: 0.15, outputPricePer1M: 0.6, supportsVision: true, supportsStreaming: true },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000, maxOutputTokens: 4096, inputPricePer1M: 10, outputPricePer1M: 30, supportsVision: true, supportsStreaming: true },
  { id: "gpt-4", name: "GPT-4", contextWindow: 8192, maxOutputTokens: 4096, inputPricePer1M: 30, outputPricePer1M: 60, supportsStreaming: true },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16385, maxOutputTokens: 4096, inputPricePer1M: 0.5, outputPricePer1M: 1.5, supportsStreaming: true },
  { id: "o1", name: "o1", contextWindow: 200000, maxOutputTokens: 100000, inputPricePer1M: 15, outputPricePer1M: 60, supportsStreaming: false },
  { id: "o1-mini", name: "o1-mini", contextWindow: 128000, maxOutputTokens: 65536, inputPricePer1M: 3, outputPricePer1M: 12, supportsStreaming: false },
  { id: "o3-mini", name: "o3-mini", contextWindow: 200000, maxOutputTokens: 100000, inputPricePer1M: 1.1, outputPricePer1M: 4.4, supportsStreaming: true },
]

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  iconColor: "#10a37f",
  iconInitials: "OA",
  models: OPENAI_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key, baseUrl) { return validateOpenAIKey(key, baseUrl || this.baseUrl) },
  async fetchModels(key, baseUrl) {
    return fetchOpenAIModels(key, baseUrl || this.baseUrl, (id) => /^(gpt-|o[134](?:-|$)|chatgpt-)/i.test(id))
  },
  async *streamChat(params) {
    // o1 models don't support streaming, but we can still call and emit as single chunk
    const effectiveBase = params.baseUrl || this.baseUrl
    if (params.model.startsWith("o1") && params.model !== "o3-mini") {
      const { nonStream } = await import("../nonstream")
      yield* nonStream({ ...params, baseUrl: effectiveBase }, effectiveBase)
      return
    }
    yield* streamOpenAIChat({ ...params, baseUrl: effectiveBase })
  },
  estimateCost(usage: TokenUsage, model: string): number {
    const m = OPENAI_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
