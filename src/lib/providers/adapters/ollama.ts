import { ModelInfo, ProviderAdapter, ChatChunk } from "../types"

const OLLAMA_MODELS: ModelInfo[] = [
  { id: "llama3.3", name: "Llama 3.3", contextWindow: 128000, supportsStreaming: true },
  { id: "llama3.1", name: "Llama 3.1", contextWindow: 128000, supportsStreaming: true },
  { id: "llama3", name: "Llama 3", contextWindow: 8192, supportsStreaming: true },
  { id: "mistral", name: "Mistral 7B", contextWindow: 8192, supportsStreaming: true },
  { id: "gemma2", name: "Gemma 2", contextWindow: 8192, supportsStreaming: true },
  { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", contextWindow: 128000, supportsStreaming: true },
  { id: "deepseek-coder-v2", name: "DeepSeek Coder V2", contextWindow: 128000, supportsStreaming: true },
  { id: "phi4", name: "Phi-4", contextWindow: 16384, supportsStreaming: true },
]

export const ollamaAdapter: ProviderAdapter = {
  id: "ollama",
  name: "Ollama (Local)",
  baseUrl: "http://localhost:11434",
  iconColor: "#000000",
  iconInitials: "OL",
  models: OLLAMA_MODELS,
  requiresBaseUrl: true,
  requiresApiKey: false,
  async validateKey(_key, baseUrl) {
    try {
      const res = await fetch(`${(baseUrl || this.baseUrl).replace(/\/$/, "")}/api/tags`)
      if (!res.ok) return { valid: false, error: `HTTP ${res.status}` }
      return { valid: true }
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Could not reach Ollama. Is it running?" }
    }
  },
  async fetchModels(_key, baseUrl) {
    const res = await fetch(`${(baseUrl || this.baseUrl).replace(/\/$/, "")}/api/tags`)
    const body = await res.text()
    if (!res.ok) throw new Error(`Ollama model list failed (HTTP ${res.status}): ${body.slice(0, 250)}`)
    const data = JSON.parse(body) as { models?: { name?: string; details?: { parameter_size?: string } }[] }
    const dynamic: ModelInfo[] = (data.models || [])
      .filter((model): model is { name: string; details?: { parameter_size?: string } } => typeof model.name === "string")
      .map((model) => ({
        id: model.name,
        name: model.details?.parameter_size ? `${model.name} (${model.details.parameter_size})` : model.name,
        contextWindow: 8192,
        supportsStreaming: true,
      }))
    if (!dynamic.length) throw new Error("No local models found. Pull a model in Ollama first.")
    return dynamic
  },
  async *streamChat(params): AsyncGenerator<ChatChunk> {
    const { model, messages, temperature = 0.7, maxTokens, signal, baseUrl } = params
    const url = `${(baseUrl || this.baseUrl).replace(/\/$/, "")}/api/chat`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
          options: { temperature, num_predict: maxTokens },
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
      let promptEvalCount = 0, evalCount = 0
      while (true) {
        const { done, value } = await reader.read()
        buf += decoder.decode(value, { stream: !done })
        const lines = buf.split("\n")
        buf = lines.pop() || ""
        if (done && buf.trim()) {
          lines.push(buf)
          buf = ""
        }
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const j = JSON.parse(line) as {
              message?: { content?: string }
              prompt_eval_count?: number
              eval_count?: number
              done?: boolean
            }
            if (j.message?.content) yield { type: "delta", content: j.message.content }
            if (j.prompt_eval_count) promptEvalCount = j.prompt_eval_count
            if (j.eval_count) evalCount = j.eval_count
            if (j.done) {
              yield { type: "usage", usage: { promptTokens: promptEvalCount, completionTokens: evalCount, totalTokens: promptEvalCount + evalCount } }
              yield { type: "done" }
              return
            }
          } catch (error) {
            yield { type: "error", error: error instanceof Error ? error.message : "Invalid Ollama streaming response" }
            return
          }
        }
        if (done) break
      }
      yield { type: "done" }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        yield { type: "error", error: error instanceof Error ? error.message : "Stream error" }
      }
      else yield { type: "done" }
    }
  },
  estimateCost() { return 0 },
}
