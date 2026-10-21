export interface ClientSSEEvent {
  event: string
  data: Record<string, unknown>
}

function getErrorMessage(body: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(body)
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>
      if (typeof record.error === "string") return record.error
      if (typeof record.message === "string") return record.message
      if (typeof record.error === "object" && record.error !== null) {
        const error = record.error as Record<string, unknown>
        if (typeof error.message === "string") return error.message
      }
    }
  } catch {
  }
  return body.trim() || `Request failed with status ${status}`
}

export async function consumeClientSSE(
  response: Response,
  onEvent: (event: ClientSSEEvent) => void
): Promise<void> {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(getErrorMessage(body, response.status))
  }
  if (!response.body) throw new Error("The server returned an empty response")

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let eventName = "message"
  let dataLines: string[] = []

  const dispatch = () => {
    const rawData = dataLines.join("\n")
    dataLines = []
    const name = eventName
    eventName = "message"
    if (rawData === "") return
    if (rawData === "[DONE]") return

    let parsed: unknown
    try {
      parsed = JSON.parse(rawData)
    } catch {
      throw new Error("The server returned an invalid streaming response")
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("The server returned an invalid streaming response")
    }
    onEvent({ event: name, data: parsed as Record<string, unknown> })
  }

  const processLine = (line: string) => {
    if (line === "") {
      dispatch()
      return
    }
    if (line.startsWith(":")) return

    const separator = line.indexOf(":")
    const field = separator === -1 ? line : line.slice(0, separator)
    const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "")
    if (field === "event") eventName = value
    if (field === "data") dataLines.push(value)
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })

      let lineStart = 0
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]
        if (char !== "\n" && char !== "\r") continue
        if (char === "\r" && i === buffer.length - 1 && !done) break

        processLine(buffer.slice(lineStart, i))
        if (char === "\r" && buffer[i + 1] === "\n") i++
        lineStart = i + 1
      }
      buffer = buffer.slice(lineStart)

      if (done) {
        if (buffer) processLine(buffer)
        dispatch()
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
