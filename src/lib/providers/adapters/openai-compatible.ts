import type { ModelInfo, ProviderAdapter } from "../types"
import { streamOpenAIChat, validateOpenAIKey } from "../streaming"

interface CompatibleProviderOptions {
  id: string
  name: string
  baseUrl: string
  iconColor: string
  iconInitials: string
  models: ModelInfo[]
  modelFilter?: (id: string) => boolean
}

export async function fetchOpenAIModels(
  apiKey: string,
  baseUrl: string,
  modelFilter?: (id: string) => boolean
): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  })
  const body = await response.text()
  if (!response.ok) {
    let message = body.slice(0, 300)
    try {
      const parsed: unknown = JSON.parse(body)
      if (typeof parsed === "object" && parsed !== null) {
        const record = parsed as Record<string, unknown>
        if (typeof record.message === "string") message = record.message
        if (typeof record.error === "string") message = record.error
        if (typeof record.error === "object" && record.error !== null) {
          const error = record.error as Record<string, unknown>
          if (typeof error.message === "string") message = error.message
        }
      }
    } catch {
    }
    throw new Error(message || `Model request failed with status ${response.status}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error("Provider returned an invalid model list")
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { data?: unknown }).data)) {
    throw new Error("Provider returned an unsupported model list")
  }

  const models = (parsed as { data: unknown[] }).data.flatMap((item): ModelInfo[] => {
    if (typeof item !== "object" || item === null) return []
    const model = item as Record<string, unknown>
    if (
      typeof model.id !== "string" ||
      !model.id ||
      /(embed|whisper|tts|moderation|rerank|dall[- ]?e|transcription|speech)/i.test(model.id) ||
      (modelFilter && !modelFilter(model.id))
    ) return []
    return [{
      id: model.id,
      name: typeof model.name === "string" && model.name ? model.name : model.id,
      contextWindow: typeof model.context_length === "number" ? model.context_length : 8192,
      supportsStreaming: true,
    }]
  })
  if (models.length === 0) throw new Error("Provider did not return any chat models")
  return models.sort((a, b) => a.name.localeCompare(b.name))
}

export function createOpenAICompatibleAdapter(options: CompatibleProviderOptions): ProviderAdapter {
  return {
    ...options,
    requiresBaseUrl: false,
    requiresApiKey: true,
    async validateKey(key, baseUrl) {
      return validateOpenAIKey(key, baseUrl || options.baseUrl)
    },
    async fetchModels(key, baseUrl) {
      return fetchOpenAIModels(key, baseUrl || options.baseUrl, options.modelFilter)
    },
    async *streamChat(params) {
      yield* streamOpenAIChat({ ...params, baseUrl: params.baseUrl || options.baseUrl })
    },
  }
}
