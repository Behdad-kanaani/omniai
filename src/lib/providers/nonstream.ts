import { ChatChunk, ChatParams } from "./types"
import { openAIHeaders } from "./streaming"

export async function* nonStream(
  params: ChatParams & { baseUrl: string },
  effectiveBaseUrl: string
): AsyncGenerator<ChatChunk> {
  try {
    const { apiKey, model, messages, temperature = 0.7, maxTokens, signal, baseUrl } = params
    const url = `${(baseUrl || effectiveBaseUrl).replace(/\/$/, "")}/chat/completions`
    const res = await fetch(url, {
      method: "POST",
      headers: openAIHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal,
    })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      yield { type: "error", error: `HTTP ${res.status}: ${t.slice(0, 300)}` }
      return
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ""
    yield { type: "delta", content }
    if (data.usage) {
      yield {
        type: "usage",
        usage: {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        },
      }
    }
    yield { type: "done", finishReason: "stop" }
  } catch (error: unknown) {
    yield { type: "error", error: error instanceof Error ? error.message : "Request failed" }
  }
}
