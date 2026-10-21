import { ChatChunk, ChatParams } from "./types"

export interface SSEEvent {
  data: string
}

export async function* streamSSE(
  response: Response,
  parseLine: (line: string) => ChatChunk | null
): AsyncGenerator<ChatChunk> {
  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error")
    let msg = `HTTP ${response.status}`
    try {
      const j = JSON.parse(errText)
      msg = j.error?.message || j.message || errText.slice(0, 500)
    } catch {
      msg = errText.slice(0, 500)
    }
    yield { type: "error", error: msg }
    return
  }

  const reader = response.body?.getReader()
  if (!reader) {
    yield { type: "error", error: "No response body" }
    return
  }
  const decoder = new TextDecoder()
  let buffer = ""

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""
      if (done && buffer) {
        lines.push(buffer)
        buffer = ""
      }
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith("data:")) continue
        const data = trimmed.slice(5).trim()
        if (data === "[DONE]") {
          yield { type: "done" }
          return
        }
        const chunk = parseLine(data)
        if (chunk) yield chunk
      }
      if (done) break
    }
    yield { type: "done" }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      yield { type: "done", finishReason: "stop" }
    } else {
      yield { type: "error", error: error instanceof Error ? error.message : "Stream error" }
    }
  } finally {
    reader.releaseLock()
  }
}

export function openAIHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }
}

export async function* streamOpenAIChat(params: ChatParams & { baseUrl: string; extraBody?: Record<string, unknown> }): AsyncGenerator<ChatChunk> {
  const { apiKey, baseUrl, model, messages, temperature = 0.7, topP, maxTokens, signal, extraBody } = params
  const body: Record<string, unknown> = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
    stream_options: { include_usage: true },
    temperature,
    ...(topP !== undefined && { top_p: topP }),
    ...(maxTokens !== undefined && { max_tokens: maxTokens }),
    ...(extraBody || {}),
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: openAIHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  })

  yield* streamSSE(res, (data) => {
    try {
      const j = JSON.parse(data) as {
        choices?: { delta?: { content?: string }; finish_reason?: string }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }
      const choice = j.choices?.[0]
      const delta = choice?.delta
      const content = delta?.content
      if (j.usage) {
        return {
          type: "usage",
          usage: {
            promptTokens: j.usage.prompt_tokens || 0,
            completionTokens: j.usage.completion_tokens || 0,
            totalTokens: j.usage.total_tokens || 0,
          },
        }
      }
      if (choice?.finish_reason === "stop" || choice?.finish_reason === "length") {
        return { type: "done", finishReason: choice.finish_reason }
      }
      if (content) return { type: "delta", content }
      return null
    } catch {
      return null
    }
  })
}

export async function validateOpenAIKey(apiKey: string, baseUrl: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: openAIHeaders(apiKey),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => "")
      let message = t.slice(0, 200) || `HTTP ${res.status}`
      try {
        const parsed: unknown = JSON.parse(t)
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
      return { valid: false, error: message }
    }
    return { valid: true }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" }
  }
}
