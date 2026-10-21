"use client"
import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Send, Square, Sparkles } from "lucide-react"

interface ChatInputProps {
  onSend: (content: string) => void
  onStop?: () => void
  isStreaming?: boolean
  placeholder?: string
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isStreaming, placeholder, disabled }: ChatInputProps) {
  const [value, setValue] = React.useState("")
  const taRef = React.useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const v = value.trim()
    if (!v || isStreaming) return
    onSend(v)
    setValue("")
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto"
    })
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const el = e.currentTarget
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 240) + "px"
  }

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="mx-auto max-w-4xl">
        <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm transition focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
          <Textarea
            ref={taRef}
            value={value}
            onChange={onInput}
            onKeyDown={onKey}
            placeholder={placeholder || "Send a message..."}
            className="border-0 shadow-none focus-visible:ring-0 resize-none min-h-[52px] max-h-[240px] py-3 pr-14 rounded-2xl"
            rows={1}
            disabled={disabled}
          />
          <div className="absolute right-2 bottom-2">
            {isStreaming ? (
              <Button size="icon" variant="destructive" onClick={onStop} aria-label="Stop generating" className="rounded-xl w-9 h-9">
                <Square className="w-4 h-4" fill="currentColor" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={submit}
                disabled={!value.trim() || disabled}
                aria-label="Send message"
                className="rounded-xl w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-center text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3" />
          {disabled
            ? "Choose a provider and model above to start chatting."
            : "Enter to send · Shift + Enter for a new line · AI output may contain mistakes."}
        </div>
      </div>
    </div>
  )
}
