import { ModelInfo, ProviderAdapter, TokenUsage, ChatChunk, ChatParams } from "../types"

const GOOGLE_MODELS: ModelInfo[] = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", contextWindow: 1_048_576, maxOutputTokens: 8192, inputPricePer1M: 0.1, outputPricePer1M: 0.4, supportsVision: true, supportsStreaming: true },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", contextWindow: 1_048_576, maxOutputTokens: 8192, inputPricePer1M: 0.075, outputPricePer1M: 0.3, supportsVision: true, supportsStreaming: true },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2_097_152, maxOutputTokens: 8192, inputPricePer1M: 1.25, outputPricePer1M: 5, supportsVision: true, supportsStreaming: true },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1_048_576, maxOutputTokens: 8192, inputPricePer1M: 0.075, outputPricePer1M: 0.3, supportsVision: true, supportsStreaming: true },
]

function convertMessages(messages: ChatParams["messages"]) {
  const sys = messages.filter((m) => m.role === "system")
  const nonSys = messages.filter((m) => m.role !== "system")
  const contents = nonSys.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  return { contents, systemInstruction: sys.length ? { parts: [{ text: sys.map((s) => s.content).join("\n\n") }] } : undefined }
}

export const googleAdapter: ProviderAdapter = {
  id: "google",
  name: "Google Gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  iconColor: "#4285f4",
  iconInitials: "G",
  models: GOOGLE_MODELS,
  requiresBaseUrl: false,
  requiresApiKey: true,
  async validateKey(key, baseUrl) {
    try {
      const res = await fetch(`${(baseUrl || this.baseUrl).replace(/\/$/, "")}/models?key=${encodeURIComponent(key)}`)
      if (!res.ok) {
        const body = await res.text()
        return { valid: false, error: body.slice(0, 250) || `HTTP ${res.status}` }
      }
      return { valid: true }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Connection failed" }
    }
  },
  async fetchModels(apiKey, baseUrl) {
    const response = await fetch(`${(baseUrl || this.baseUrl).replace(/\/$/, "")}/models?key=${encodeURIComponent(apiKey)}`)
    const body = await response.text()
    if (!response.ok) throw new Error(`Google model list failed (HTTP ${response.status}): ${body.slice(0, 250)}`)
    const data = JSON.parse(body) as {
      models?: {
        name?: string
        displayName?: string
        inputTokenLimit?: number
        supportedGenerationMethods?: string[]
      }[]
    }
    const models = (data.models || [])
      .filter((model) =>
        typeof model.name === "string" &&
        model.name.startsWith("models/gemini-") &&
        model.supportedGenerationMethods?.includes("generateContent")
      )
      .map((model) => {
        const id = model.name!.replace(/^models\//, "")
        return {
          id,
          name: model.displayName || id,
          contextWindow: model.inputTokenLimit || 8192,
          supportsStreaming: true,
        }
      })
    if (!models.length) throw new Error("Google did not return any Gemini chat models")
    return models
  },
  async *streamChat(params): AsyncGenerator<ChatChunk> {
    const { apiKey, model, messages, temperature = 0.7, maxTokens = 8192, signal, baseUrl } = params
    const { contents, systemInstruction } = convertMessages(messages)
    const url = `${(baseUrl || this.baseUrl).replace(/\/$/, "")}/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
        signal,
      })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        yield { type: "error", error: `HTTP ${res.status}: ${t.slice(0, 300)}` }
        return
      }
      const reader = res.body?.getReader()
      if (!reader) { yield { type: "error", error: "No body" }; return }
      const decoder = new TextDecoder()
      let buf = ""
      let promptTokens = 0, completionTokens = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() || ""
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith("data:")) continue
          try {
            const j = JSON.parse(t.slice(5).trim()) as {
              candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
            }
            const c = j.candidates?.[0]
            const text = c?.content?.parts?.map((part) => part.text || "").join("")
            if (text) yield { type: "delta", content: text }
            if (j.usageMetadata) {
              promptTokens = j.usageMetadata.promptTokenCount || 0
              completionTokens = j.usageMetadata.candidatesTokenCount || 0
            }
          } catch (error) {
            yield { type: "error", error: error instanceof Error ? error.message : "Invalid Google streaming response" }
            return
          }
        }
      }
      yield { type: "usage", usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens } }
      yield { type: "done" }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        yield { type: "error", error: error instanceof Error ? error.message : "Stream error" }
      }
      else yield { type: "done" }
    }
  },
  estimateCost(usage: TokenUsage, model: string): number {
    const m = GOOGLE_MODELS.find((mm) => mm.id === model)
    if (!m?.inputPricePer1M || !m.outputPricePer1M) return 0
    return (usage.promptTokens * m.inputPricePer1M + usage.completionTokens * m.outputPricePer1M) / 1_000_000
  },
}
