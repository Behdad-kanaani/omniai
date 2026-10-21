"use client"
import * as React from "react"
import { useRouter } from "next/navigation"
import { useChatStore } from "@/store/chat"
import { MessageContent } from "./message-content"
import { ChatInput } from "./chat-input"
import { ModelPicker } from "./model-picker"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { PROVIDER_DEFINITIONS, getAdapter } from "@/lib/providers/registry"
import { Settings2, Copy, RotateCcw, Bot, Sparkles, Workflow, FolderCode, Terminal, ArrowUpRight, LockKeyhole } from "lucide-react"
import { toast } from "@/components/ui/toast"
import { useQueryClient } from "@tanstack/react-query"
import { generateId } from "@/lib/utils"
import { consumeClientSSE } from "@/lib/client-sse"
import type { UiMessage } from "@/store/chat"

interface ConversationResponse {
  conversation?: {
    messages: UiMessage[]
    systemPrompt?: string | null
    modelId?: string | null
    credentialId?: string | null
  }
}

export function ChatPanel() {
  const {
    conversationId,
    messages,
    isStreaming,
    selectedCredentialId,
    selectedModel,
    temperature,
    maxTokens,
    systemPrompt,
    setConversation,
    setMessages,
    addMessage,
    updateAssistant,
    setStreaming,
    setSelectedCredential,
    setSelectedModel,
    setSystemPrompt,
    setTemperature,
    setMaxTokens,
    reset,
  } = useChatStore()

  const [agentMode, setAgentMode] = React.useState(false)
  const [workspacePath, setWorkspacePath] = React.useState("")
  const [showSettings, setShowSettings] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  React.useEffect(() => {
    if (!conversationId) return
    let active = true
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => r.json() as Promise<ConversationResponse>)
      .then((data) => {
        if (!active || !data.conversation) return
        const conv = data.conversation
        setMessages(
          conv.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            modelId: m.modelId,
            providerId: m.providerId,
          }))
        )
        if (conv.systemPrompt) setSystemPrompt(conv.systemPrompt)
        if (conv.modelId) setSelectedModel(conv.modelId)
        if (conv.credentialId) setSelectedCredential(conv.credentialId)
      })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async (text: string) => {
    if (!selectedCredentialId || !selectedModel) {
      toast("Please select a provider and model first", "error")
      return
    }
    const userMsg = { id: generateId(), role: "user" as const, content: text }
    const assistMsg = { id: generateId(), role: "assistant" as const, content: "", streaming: true }
    addMessage(userMsg)
    addMessage(assistMsg)
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const payload = {
        conversationId: conversationId || undefined,
        credentialId: selectedCredentialId,
        model: selectedModel,
        messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }],
        temperature,
        maxTokens,
        systemPrompt: systemPrompt || undefined,
        agentMode,
        workspacePath: agentMode && workspacePath.trim() ? workspacePath.trim() : undefined,
      }
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      await consumeClientSSE(res, ({ event, data }) => {
        if (event === "meta" && typeof data.conversationId === "string" && !conversationId) {
          setConversation(data.conversationId)
          queryClient.invalidateQueries({ queryKey: ["conversations-list"] })
        } else if (event === "agent") {
          updateAssistant(assistMsg.id, (m) => ({ ...m, agentTrace: [...(m.agentTrace || []), { phase: String(data.phase), detail: String(data.detail), step: Number(data.step) }] }))
        } else if (event === "delta" && typeof data.content === "string") {
          updateAssistant(assistMsg.id, (m) => ({ ...m, content: m.content + data.content }))
        } else if (event === "error" && typeof data.error === "string") {
          const errorMessage = data.error
          updateAssistant(assistMsg.id, (m) => ({ ...m, error: errorMessage, streaming: false }))
        } else if (event === "done") {
          updateAssistant(assistMsg.id, (m) => ({ ...m, streaming: false }))
        }
      })
      updateAssistant(assistMsg.id, (m) => ({ ...m, streaming: false }))
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        updateAssistant(assistMsg.id, (m) => ({ ...m, error: error instanceof Error ? error.message : "Unable to read the server response", streaming: false }))
      } else {
        updateAssistant(assistMsg.id, (m) => ({ ...m, streaming: false }))
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      queryClient.invalidateQueries({ queryKey: ["conversations-list"] })
    }
  }

  const stop = () => { abortRef.current?.abort() }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast("Copied to clipboard", "success"))
  }

  const clearChat = () => {
    abortRef.current?.abort()
    reset()
    router.replace("/chat")
  }

  return (
    <div className="flex flex-col h-full omniai-chat">
      <div className="glass-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6"><div className="flex min-w-0 items-center gap-2"><span className="hidden sm:inline-flex studio-status-dot mr-1"/><span className="hidden sm:inline text-xs font-semibold text-slate-500">Model</span>
        <ModelPicker
          credentialId={selectedCredentialId}
          modelId={selectedModel}
          onCredentialChange={setSelectedCredential}
          onModelChange={setSelectedModel}
        /></div>
        <div className="chat-toolbar-actions flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={() => setAgentMode((v) => !v)} aria-pressed={agentMode} className={`agent-mode-toggle ${agentMode ? "agent-mode-on" : ""}`}><Bot className="w-4 h-4" /> Agent {agentMode ? "ON" : "OFF"}</button>
          <Button variant="ghost" size="sm" aria-expanded={showSettings} aria-controls={showSettings ? "chat-settings" : undefined} onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="w-4 h-4 mr-1" /> Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={clearChat} title="Start a new conversation">
            <RotateCcw className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
      </div>

      {agentMode && (
        <section className="studio-workspace-bar px-5 md:px-8 py-4" aria-label="Workspace configuration">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4 max-w-6xl mx-auto">
            <div className="flex gap-3 items-center min-w-0"><span className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600"><FolderCode className="h-5 w-5"/></span><div><h3 className="text-sm font-bold text-slate-800">Workspace Agent</h3><p className="text-[11px] text-slate-500">Read, inspect and edit a local project</p></div></div>
            <div className="flex-1 min-w-0"><label htmlFor="workspace-path" className="sr-only">Absolute path to workspace folder</label><div className="flex items-center gap-2 studio-workspace-input px-3"><Terminal className="h-4 w-4 text-slate-400 shrink-0"/><input id="workspace-path" value={workspacePath} onChange={(e) => setWorkspacePath(e.target.value)} placeholder="F:\Projects\my-app  or  /home/user/project" spellCheck={false} className="w-full min-w-0 py-3 text-[13px] bg-transparent outline-none font-mono"/></div></div>
            <span className="inline-flex gap-1.5 items-center text-[11px] text-slate-500"><LockKeyhole className="h-3.5 w-3.5 text-emerald-600"/> Scoped to selected folder</span>
          </div>
        </section>
      )}
      {showSettings && (
        <div id="chat-settings" className="border-b border-gray-200 bg-gray-50 px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">System prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-md border border-gray-300 text-sm p-2 h-20 resize-y"
              placeholder="You are a helpful assistant..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Temperature: {temperature.toFixed(2)}</label>
            <input
              type="range" min={0} max={2} step={0.05} value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Lower = focused, higher = creative</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Max tokens: {maxTokens}</label>
            <input
              type="range" min={256} max={32768} step={256} value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
            <div className="w-[72px] h-[72px] rounded-[24px] bg-gradient-to-br from-indigo-500 via-violet-600 to-cyan-500 flex items-center justify-center mb-7 shadow-xl shadow-indigo-500/20 ring-8 ring-white/60">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="hero-eyebrow"><Sparkles className="w-4 h-4"/> ONE WORKSPACE. EVERY IDEA.</div>
            <h2 className="text-3xl md:text-[50px] leading-[1.12] tracking-[-.05em] font-bold text-slate-900 mb-4">Think bigger. <span className="hero-gradient">Build faster.</span></h2>
            <p className="text-slate-500 text-[14px] leading-7 max-w-xl mb-9">
              One beautiful workspace for your models, ideas and autonomous workflows. Switch models seamlessly, compare answers, or enable Agent mode for multi-step reasoning and tools.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-[640px] w-full text-left">
              {[
                { title: "Explore an idea", desc: "Research and reason across models" },
                { title: "Refactor a project", desc: "Inspect and improve real files" },
                { title: "Plan a feature", desc: "From architecture to implementation" },
                { title: "Debug a problem", desc: "Analyze errors and propose fixes" },
              ].map((s) => (
                <button
                  key={s.title}
                  onClick={() => send(s.title + ": " + s.desc)}
                  className="suggestion-card"
                >
                  <div className="text-sm font-semibold text-slate-800 flex items-center justify-between">{s.title}<ArrowUpRight className="w-3.5 h-3.5 text-slate-400"/></div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-6 px-4 md:px-6 space-y-6">
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onCopy={() => copy(m.content)} />
            ))}
          </div>
        )}
      </div>

      <ChatInput onSend={send} onStop={stop} isStreaming={isStreaming} disabled={!selectedCredentialId || !selectedModel} />
    </div>
  )
}

function MessageBubble({ msg, onCopy }: { msg: UiMessage; onCopy: () => void }) {
  const isUser = msg.role === "user"
  const def = msg.providerId ? PROVIDER_DEFINITIONS[msg.providerId] : null
  const adapter = msg.providerId ? getAdapter(msg.providerId) : null
  const modelInfo = adapter?.models.find((mm) => mm.id === msg.modelId)
  const agentTrace = msg.agentTrace ?? []

  if (isUser) {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-600 text-white px-4 py-3 shadow-sm">
          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
        </div>
        <Avatar fallback="You" className="w-8 h-8 bg-gray-700" />
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: def?.iconColor || "#6366f1" }}>
        {def?.iconInitials || "AI"}
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">{def?.name || "Assistant"}</span>
          {msg.modelId && <Badge variant="gray">{modelInfo?.name || msg.modelId}</Badge>}
          {msg.streaming && <Spinner className="w-3 h-3 text-indigo-500" />}
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 px-4 py-3 shadow-sm">
          {agentTrace.length > 0 && <details className="agent-trace mb-3" open={msg.streaming}><summary><Workflow className="w-4 h-4"/> Agent activity · {agentTrace.length} events</summary><div className="agent-steps">{agentTrace.map((trace, i) => <div className="agent-step" key={i}><span className="agent-step-dot"/><span className="uppercase text-[10px] tracking-wider opacity-65">{trace.phase}</span><span className="break-words">{trace.detail}</span></div>)}</div></details>}
          {msg.content ? (
            <MessageContent content={msg.content} />
          ) : !msg.error && msg.streaming ? (
            <div className="flex gap-1 py-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          ) : null}
          {msg.error && <div className="text-sm text-red-600 mt-2">Error: {msg.error}</div>}
          {!msg.streaming && msg.content && (
            <button onClick={onCopy} className="mt-2 text-xs text-gray-400 hover:text-indigo-600 inline-flex items-center gap-1">
              <Copy className="w-3 h-3" /> Copy
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
