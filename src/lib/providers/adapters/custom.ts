import { ModelInfo, ProviderAdapter } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"
import { fetchOpenAIModels } from "./openai-compatible"

const CUSTOM_DEFAULT_MODELS: ModelInfo[] = [
  { id: "default", name: "default", contextWindow: 8192, supportsStreaming: true },
]

export const customAdapter: ProviderAdapter = {
  id: "custom",
  name: "Custom (OpenAI-compatible)",
  baseUrl: "",
  iconColor: "#6b7280",
  iconInitials: "CU",
  models: CUSTOM_DEFAULT_MODELS,
  requiresBaseUrl: true,
  requiresApiKey: false,
  async validateKey(key, baseUrl) {
    if (!baseUrl) return { valid: false, error: "Base URL is required" }
    if (!key) {
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`)
        const body = await response.text()
        if (response.ok) return { valid: true }
        return { valid: false, error: body.slice(0, 200) || `HTTP ${response.status}` }
      } catch (error) {
        return { valid: false, error: error instanceof Error ? error.message : "Connection failed" }
      }
    }
    return validateOpenAIKey(key, baseUrl)
  },
  async fetchModels(key, baseUrl) {
    if (!baseUrl) throw new Error("Base URL is required to load models")
    return fetchOpenAIModels(key, baseUrl)
  },
  async *streamChat(params) {
    if (!params.baseUrl) {
      yield { type: "error", error: "Base URL is required for custom endpoints" }
      return
    }
    yield* streamOpenAIChat({ ...params, baseUrl: params.baseUrl })
  },
  estimateCost() { return 0 },
}
