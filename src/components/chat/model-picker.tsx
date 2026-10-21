"use client"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Select, SelectOption } from "@/components/ui/select"
import { PROVIDER_DEFINITIONS, getAdapter } from "@/lib/providers/registry"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Search } from "lucide-react"
import type { ProviderDefinition } from "@/lib/providers/types"

interface Credential {
  id: string
  providerId: string
  displayName: string | null
  baseUrl: string | null
  isVerified: boolean
  maskedKey: string
}

interface ProviderData {
  available: ProviderDefinition[]
  credentials: Credential[]
}

const EMPTY_CREDENTIALS: Credential[] = []

async function fetchProviders(): Promise<ProviderData> {
  const res = await fetch("/api/providers")
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Unable to load providers")
  return data as ProviderData
}

export function ModelPicker({
  credentialId,
  modelId,
  onCredentialChange,
  onModelChange,
}: {
  credentialId: string | null
  modelId: string | null
  onCredentialChange: (id: string) => void
  onModelChange: (m: string) => void
}) {
  const { data, isLoading, isError } = useQuery({ queryKey: ["providers"], queryFn: fetchProviders })
  const [models, setModels] = React.useState<SelectOption[]>([])
  const [loadingModels, setLoadingModels] = React.useState(false)
  const [modelWarning, setModelWarning] = React.useState("")
  const [reloadModels, setReloadModels] = React.useState(0)
  const [modelSearch, setModelSearch] = React.useState("")

  const credentials = data?.credentials ?? EMPTY_CREDENTIALS
  const verifiedCredentials = credentials.filter((c) => c.isVerified)

  const credentialOptions: SelectOption[] = verifiedCredentials.map((c) => {
    const def = PROVIDER_DEFINITIONS[c.providerId]
    return {
      value: c.id,
      label: c.displayName || def?.name || c.providerId,
      description: `${def?.name || c.providerId} • ${c.maskedKey}`,
    }
  })
  const visibleModels = models.filter((model) =>
    `${model.label} ${model.value}`.toLowerCase().includes(modelSearch.trim().toLowerCase())
  )

  const loadedCredRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!credentialId) {
        if (models.length > 0) setModels([])
        if (modelWarning) setModelWarning("")
        if (modelSearch) setModelSearch("")
        loadedCredRef.current = null
        return
      }
      if (loadedCredRef.current === credentialId && models.length > 0) return
      const cred = credentials.find((c) => c.id === credentialId)
      if (!cred) return
      loadedCredRef.current = credentialId
      setLoadingModels(true)
      setModelWarning("")
      try {
        const res = await fetch("/api/providers/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: cred.providerId, credentialId: cred.id }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || "Unable to load models")
        const adapter = getAdapter(cred.providerId)
        const list = (data.models?.length ? data.models : cred.providerId === "ollama" ? [] : adapter.models) as { id: string; name: string; description?: string }[]
        const opts = list.map((m) => ({
          value: m.id,
          label: m.name || m.id,
          meta: m.description,
        }))
        setModels(opts)
        if (data.warning) setModelWarning(data.warning)
        if (list.length === 0) {
          onModelChange("")
        } else if (!modelId || !list.find((x) => x.id === modelId)) {
          onModelChange(list[0].id)
        }
      } catch (error) {
        if (cancelled) return
        const adapter = getAdapter(cred.providerId)
        setModels(adapter.models.map((m) => ({ value: m.id, label: m.name })))
        setModelWarning(error instanceof Error ? error.message : "Unable to load models")
      } finally {
        if (!cancelled) setLoadingModels(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentialId, reloadModels, credentials])

  if (isLoading) return <Spinner className="w-4 h-4 text-gray-500" />
  if (isError) return <span role="alert" className="text-xs text-red-600">Unable to load providers. Refresh the page and try again.</span>

  if (verifiedCredentials.length === 0) {
    return (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        No providers configured.{" "}
        <a href="/providers" className="underline font-medium">Add your first API key →</a>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={credentialId || ""}
        onChange={onCredentialChange}
        options={credentialOptions}
        placeholder="Select provider..."
        className="w-48"
      />
      {models.length > 20 && (
        <div className="relative w-44">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={modelSearch}
            onChange={(event) => setModelSearch(event.target.value)}
            placeholder="Search models..."
            aria-label="Search models"
            className="h-9 pl-8 text-xs"
          />
        </div>
      )}
      <div className="relative">
        <Select
          value={modelId || ""}
          onChange={onModelChange}
          options={visibleModels}
          placeholder={loadingModels ? "Loading models..." : "Select model..."}
          className="w-56"
          disabled={loadingModels || !credentialId}
        />
      </div>
      {credentialId && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            loadedCredRef.current = null
            setReloadModels((value) => value + 1)
          }}
          disabled={loadingModels}
          aria-label="Refresh model list"
          title="Refresh model list"
        >
          {loadingModels ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      )}
      {modelWarning && <span role="status" className="w-full text-xs text-amber-700">{modelWarning} Showing the saved model list.</span>}
      {credentialId && (() => {
        const cred = credentials.find((c) => c.id === credentialId)
        if (!cred) return null
        const def = PROVIDER_DEFINITIONS[cred.providerId]
        return <Badge variant="gray">{def?.name}</Badge>
      })()}
    </div>
  )
}
