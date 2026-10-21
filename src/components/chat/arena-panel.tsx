"use client"
import * as React from "react"
import { useChatStore } from "@/store/chat"
import { MessageContent } from "./message-content"
import { ChatInput } from "./chat-input"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { PROVIDER_DEFINITIONS, getAdapter } from "@/lib/providers/registry"
import { Plus, X, Copy, RefreshCw, Search, Swords } from "lucide-react"
import { Select, SelectOption } from "@/components/ui/select"
import { toast } from "@/components/ui/toast"
import { useQuery } from "@tanstack/react-query"
import { useQueryClient } from "@tanstack/react-query"
import { generateId } from "@/lib/utils"
import { consumeClientSSE } from "@/lib/client-sse"
import { Input } from "@/components/ui/input"
import type { ModelInfo } from "@/lib/providers/types"
import Link from "next/link"

interface Credential {
  id: string
  providerId: string
  displayName: string | null
  baseUrl: string | null
  isVerified: boolean
  maskedKey: string
}

interface ProviderData {
  credentials: Credential[]
}

interface CredentialModelState {
  models: ModelInfo[]
  loading: boolean
  warning?: string
}

const EMPTY_CREDENTIALS: Credential[] = []

async function fetchProviders(): Promise<ProviderData> {
  const res = await fetch("/api/providers")
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Unable to load providers")
  return data as ProviderData
}

export function ArenaPanel() {
  const {
    conversationId,
    messages,
    isStreaming,
    arenaParticipants,
    arenaOutputs,
    temperature,
    maxTokens,
    setArenaParticipants,
    initArena,
    updateArenaParticipant,
    setConversation,
    setStreaming,
    setTemperature,
    setMaxTokens,
    reset,
  } = useChatStore()

  const { data } = useQuery({ queryKey: ["providers"], queryFn: fetchProviders })
  const credentials = React.useMemo(
    () => (data?.credentials ?? EMPTY_CREDENTIALS).filter((credential) => credential.isVerified),
    [data?.credentials]
  )
  const abortRef = React.useRef<AbortController | null>(null)
  const queryClient = useQueryClient()
  const [userMessages, setUserMessages] = React.useState<{ id: string; content: string }[]>([])
  const [modelCatalogs, setModelCatalogs] = React.useState<Record<string, CredentialModelState>>({})
  const [modelSearch, setModelSearch] = React.useState("")
  const [catalogRefresh, setCatalogRefresh] = React.useState(0)

  React.useEffect(() => {
    if (credentials.length === 0) {
      setModelCatalogs({})
      return
    }
    let cancelled = false
    setModelCatalogs((current) => {
      const next: Record<string, CredentialModelState> = {}
      for (const credential of credentials) {
        const previous = current[credential.id]
        next[credential.id] = {
          models: previous?.models || [],
          loading: true,
        }
      }
      return next
    })

    void Promise.all(credentials.map(async (credential) => {
      try {
        const response = await fetch("/api/providers/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: credential.providerId, credentialId: credential.id }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Unable to load models")

        const adapter = getAdapter(credential.providerId)
        const models = (data.models?.length
          ? data.models
          : credential.providerId === "ollama" ? [] : adapter.models) as ModelInfo[]
        if (!cancelled) {
          setModelCatalogs((current) => ({
            ...current,
            [credential.id]: {
              models,
              loading: false,
              warning: data.warning,
            },
          }))

          const participants = useChatStore.getState().arenaParticipants
          const nextParticipants = participants.map((participant) => {
            if (participant.credentialId !== credential.id) return participant
            if (models.some((model) => model.id === participant.model)) return participant
            return { ...participant, model: models[0]?.id || "" }
          })
          if (nextParticipants.some((participant, index) => participant !== participants[index])) {
            setArenaParticipants(nextParticipants)
          }
        }
      } catch (error) {
        if (cancelled) return
        const adapter = getAdapter(credential.providerId)
        const models = credential.providerId === "ollama" ? [] : adapter.models
        setModelCatalogs((current) => ({
          ...current,
          [credential.id]: {
            models,
            loading: false,
            warning: error instanceof Error ? error.message : "Unable to load models",
          },
        }))

        const participants = useChatStore.getState().arenaParticipants
        const nextParticipants = participants.map((participant) => {
          if (participant.credentialId !== credential.id) return participant
          if (models.some((model) => model.id === participant.model)) return participant
          return { ...participant, model: models[0]?.id || "" }
        })
        if (nextParticipants.some((participant, index) => participant !== participants[index])) {
          setArenaParticipants(nextParticipants)
        }
      }
    }))

    return () => { cancelled = true }
  }, [credentials, catalogRefresh, setArenaParticipants])

  const credentialOptions: SelectOption[] = credentials.map((c) => {
    const def = PROVIDER_DEFINITIONS[c.providerId]
    return { value: c.id, label: c.displayName || def?.name || c.providerId, description: `${def?.name || ""} • ${c.maskedKey}` }
  })

  const addParticipant = () => {
    if (arenaParticipants.length >= 4) { toast("Max 4 models in arena", "error"); return }
    if (credentials.length === 0) return
    const first = credentials[0]
    const models = modelCatalogs[first.id]?.models || []
    setArenaParticipants([...arenaParticipants, { credentialId: first.id, model: models[0]?.id || "" }])
  }

  const removeParticipant = (idx: number) => {
    setArenaParticipants(arenaParticipants.filter((_, i) => i !== idx))
  }

  const updateParticipant = (idx: number, patch: Partial<{ credentialId: string; model: string }>) => {
    const next = [...arenaParticipants]
    next[idx] = { ...next[idx], ...patch }
    setArenaParticipants(next)
  }

  const getModelOptions = (credentialId: string): SelectOption[] => {
    const state = modelCatalogs[credentialId]
    return (state?.models || [])
      .filter((model) => `${model.name} ${model.id}`.toLowerCase().includes(modelSearch.trim().toLowerCase()))
      .map((model) => ({ value: model.id, label: model.name || model.id }))
  }

  const refreshModelCatalogs = () => {
    setModelCatalogs((current) => Object.fromEntries(
      Object.entries(current).map(([id, state]) => [id, { ...state, loading: true }])
    ))
    setCatalogRefresh((value) => value + 1)
  }

  const send = async (text: string) => {
    if (arenaParticipants.length < 2) { toast("Add at least 2 models to compare", "error"); return }
    for (const p of arenaParticipants) {
      if (
        !p.credentialId ||
        !p.model ||
        modelCatalogs[p.credentialId]?.loading ||
        !modelCatalogs[p.credentialId]?.models.some((model) => model.id === p.model)
      ) {
        toast("Select a loaded model for every participant", "error")
        return
      }
    }

    const userMsgId = generateId()
    setUserMessages((prev) => [...prev, { id: userMsgId, content: text }])
    initArena()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const payload = {
        conversationId: conversationId || undefined,
        participants: arenaParticipants,
        messages: [
          ...messages.filter((m) => m.role === "user").map((m) => ({ role: "user" as const, content: m.content })),
          ...userMessages.map((m) => ({ role: "user" as const, content: m.content })),
          { role: "user" as const, content: text },
        ],
        temperature,
        maxTokens,
      }
      const res = await fetch("/api/chat/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      await consumeClientSSE(res, ({ event, data }) => {
        if (event === "meta" && typeof data.conversationId === "string" && !conversationId) {
          setConversation(data.conversationId)
          queryClient.invalidateQueries({ queryKey: ["conversations-list"] })
        } else if (
          event === "delta" &&
          typeof data.credentialId === "string" &&
          typeof data.model === "string" &&
          typeof data.content === "string"
        ) {
          const cur = useChatStore.getState().arenaOutputs[`${data.credentialId}::${data.model}`]
          if (cur) {
            updateArenaParticipant(data.credentialId, data.model, { content: cur.content + data.content, error: undefined })
          }
        } else if (
          event === "error" &&
          typeof data.credentialId === "string" &&
          typeof data.model === "string" &&
          typeof data.error === "string"
        ) {
          updateArenaParticipant(data.credentialId, data.model, { error: data.error, streaming: false })
        } else if (event === "done" && typeof data.credentialId === "string" && typeof data.model === "string") {
          updateArenaParticipant(data.credentialId, data.model, { streaming: false })
        }
      })
      setStreaming(false)
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        toast(error instanceof Error ? error.message : "Unable to read the server response", "error")
      }
      setStreaming(false)
    } finally {
      abortRef.current = null
      queryClient.invalidateQueries({ queryKey: ["conversations-list"] })
    }
  }

  const stop = () => { abortRef.current?.abort(); setStreaming(false) }
  const clear = () => { reset(); setUserMessages([]); setArenaParticipants(arenaParticipants.length >= 2 ? arenaParticipants.slice(0, 2) : []) }

  React.useEffect(() => {
    if (arenaParticipants.length === 0 && credentials.length >= 1) {
      const first = credentials[0]
      const second = credentials[1] || first
      const firstModel = modelCatalogs[first.id]?.models[0]?.id || ""
      const secondModels = modelCatalogs[second.id]?.models || []
      const secondModel = second.id === first.id
        ? secondModels[1]?.id || secondModels[0]?.id || ""
        : secondModels[0]?.id || ""
      setArenaParticipants([
        { credentialId: first.id, model: firstModel },
        { credentialId: second.id, model: secondModel },
      ])
    }
  }, [credentials, modelCatalogs, arenaParticipants.length, setArenaParticipants])

  const copy = (text: string) => { navigator.clipboard.writeText(text).then(() => toast("Copied", "success")) }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gray-200 bg-white px-4 py-4 md:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Arena Mode
              <Badge variant="purple">Compare up to 4 models</Badge>
            </h2>
            <p className="text-xs text-gray-500">Send the same prompt to multiple models side-by-side.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshModelCatalogs}
              disabled={credentials.length === 0 || Object.values(modelCatalogs).some((catalog) => catalog.loading)}
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${Object.values(modelCatalogs).some((catalog) => catalog.loading) ? "animate-spin" : ""}`} />
              Refresh models
            </Button>
            <Button size="sm" variant="outline" onClick={addParticipant} disabled={arenaParticipants.length >= 4}>
              <Plus className="w-4 h-4 mr-1" /> Add model
            </Button>
            <Button size="sm" variant="ghost" onClick={clear}>New Arena</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {arenaParticipants.map((p, i) => (
          <div key={i} className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:w-auto sm:flex-row sm:items-center sm:p-1">
              <Select
                value={p.credentialId}
                onChange={(v) => {
                  const cred = credentials.find((c) => c.id === v)
                  if (!cred) return
                  const models = modelCatalogs[v]?.models || []
                  const currentModel = models.some((model) => model.id === p.model)
                    ? p.model
                    : models[0]?.id || ""
                  updateParticipant(i, { credentialId: v, model: currentModel })
                }}
                options={credentialOptions}
                className="w-full sm:w-40"
                placeholder="Provider..."
              />
              <Select
                value={p.model}
                onChange={(v) => updateParticipant(i, { model: v })}
                options={getModelOptions(p.credentialId)}
                className="w-full sm:w-48"
                placeholder={modelCatalogs[p.credentialId]?.loading ? "Loading models..." : "Model..."}
                disabled={modelCatalogs[p.credentialId]?.loading || !getModelOptions(p.credentialId).length}
              />
              {arenaParticipants.length > 2 && (
                <button type="button" aria-label={`Remove model ${i + 1}`} onClick={() => removeParticipant(i)} className="self-end rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 sm:self-auto">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <div className="flex items-center gap-4 text-xs text-gray-600 sm:ml-auto">
            <label className="flex items-center gap-1">Temp: <input type="number" min={0} max={2} step={0.1} value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)} className="w-14 border rounded px-1 py-0.5" /></label>
            <label className="flex items-center gap-1">Max: <input type="number" min={256} max={32768} step={256} value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)} className="w-20 border rounded px-1 py-0.5" /></label>
          </div>
          {credentials.length === 0 && (
            <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Connect and verify a provider before comparing models.{" "}
              <Link href="/providers" className="font-semibold underline underline-offset-2">Open providers</Link>
            </div>
          )}
          {arenaParticipants.some((participant) => modelCatalogs[participant.credentialId]?.warning) && (
            <p className="mt-2 text-xs text-amber-700">
              {Array.from(new Set(arenaParticipants
                .map((participant) => modelCatalogs[participant.credentialId]?.warning)
                .filter((warning): warning is string => Boolean(warning)))).join(" • ")}
            </p>
          )}
          {Object.values(modelCatalogs).some((catalog) => catalog.models.length > 12) && (
            <div className="mt-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="Search models..."
                className="h-8 max-w-xs text-xs"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {userMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><Swords className="h-7 w-7" /></div>
            <h2 className="mb-2 text-xl font-bold text-slate-900 md:text-2xl">Compare models side by side</h2>
            <p className="text-gray-500 max-w-md">Pick 2-4 models and send a prompt. Responses stream in side-by-side so you can judge quality, speed, and style for yourself.</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-[1600px] mx-auto">
            {userMessages.map((um, ui) => (
              <div key={um.id}>
                <div className="flex gap-3 justify-end mb-4">
                  <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-indigo-600 text-white px-4 py-3 text-sm whitespace-pre-wrap shadow">{um.content}</div>
                  <Avatar fallback="You" className="w-8 h-8 bg-gray-700" />
                </div>
                {ui === userMessages.length - 1 ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
                    {arenaParticipants.map((p, i) => {
                      const key = `${p.credentialId}::${p.model}`
                      const out = arenaOutputs[key]
                      const cred = credentials.find((c) => c.id === p.credentialId)
                      const def = cred ? PROVIDER_DEFINITIONS[cred.providerId] : null
                      return (
                        <div key={i} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
                          <div className="flex items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <div className="w-6 h-6 rounded text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: def?.iconColor || "#888" }}>{def?.iconInitials || "?"}</div>
                              <span className="text-sm font-medium">{def?.name}</span>
                              <Badge variant="gray" className="max-w-[45%] truncate">{p.model}</Badge>
                            </div>
                            {out?.streaming && <Spinner className="w-3 h-3 text-indigo-500" />}
                            {out?.content && <button type="button" aria-label={`Copy ${p.model} response`} onClick={() => copy(out.content)} className="rounded-md p-1 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600"><Copy className="w-3.5 h-3.5" /></button>}
                          </div>
                          <div className="p-3 text-sm overflow-y-auto max-h-[60vh]">
                            {out?.content ? (
                              <MessageContent content={out.content} />
                            ) : !out?.error && out?.streaming !== false ? (
                              <div className="flex gap-1 py-2">
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                              </div>
                            ) : !out?.error ? <div className="text-gray-400 text-xs">Waiting...</div> : null}
                            {out?.error && <div className="text-red-600 text-xs mt-2">Error: {out.error}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <ChatInput
        onSend={send}
        onStop={stop}
        isStreaming={isStreaming}
        disabled={arenaParticipants.length < 2 || arenaParticipants.some((participant) =>
          !participant.model ||
          modelCatalogs[participant.credentialId]?.loading ||
          !modelCatalogs[participant.credentialId]?.models.some((model) => model.id === participant.model)
        )}
        placeholder="Ask all models the same question..."
      />
    </div>
  )
}
