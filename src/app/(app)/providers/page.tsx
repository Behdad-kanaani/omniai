"use client"
import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { PROVIDER_DEFINITIONS, getAllProviders } from "@/lib/providers/registry"
import type { ProviderDefinition } from "@/lib/providers/types"
import { KeyRound, Plus, Trash2, CheckCircle, XCircle, ExternalLink, RefreshCw, Search } from "lucide-react"
import { toast } from "@/components/ui/toast"

interface Credential {
  id: string
  providerId: string
  displayName: string | null
  baseUrl: string | null
  isVerified: boolean
  maskedKey: string
}

export default function ProvidersPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["providers"],
    queryFn: async () => {
      const r = await fetch("/api/providers")
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || "Unable to load providers")
      return result
    },
  })
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [selectedProvider, setSelectedProvider] = React.useState<string>("")
  const [apiKey, setApiKey] = React.useState("")
  const [baseUrl, setBaseUrl] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [adding, setAdding] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const credentials: Credential[] = data?.credentials || []
  const available = data?.available || getAllProviders()

  const addMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: selectedProvider, apiKey, baseUrl, displayName }),
      })
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || "Unable to connect provider")
      return result
    },
    onSuccess: (data) => {
      if (data.error) { toast(data.error, "error"); return }
      if (!data.validation?.valid) {
        toast(`Key saved, but validation failed: ${data.validation?.error || "unknown error"}`, "error")
      } else {
        toast("Provider added successfully", "success")
      }
      qc.invalidateQueries({ queryKey: ["providers"] })
      setDialogOpen(false)
      setApiKey(""); setBaseUrl(""); setDisplayName(""); setSelectedProvider("")
    },
    onError: (error: unknown) => toast(error instanceof Error ? error.message : "Failed", "error"),
    onSettled: () => setAdding(false),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/providers/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Unable to remove provider")
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["providers"] }); toast("Removed", "success") },
    onError: (error: unknown) => toast(error instanceof Error ? error.message : "Unable to remove provider", "error"),
  })

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentialId: id }),
      })
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || "Unable to test provider")
      return result
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["providers"] })
      if (data.valid) toast("Connection successful", "success")
      else toast(`Connection failed: ${data.error || "unknown"}`, "error")
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Unable to test provider", "error"),
  })

  const openAdd = (providerId: string) => {
    setSelectedProvider(providerId)
    const def = PROVIDER_DEFINITIONS[providerId]
    setBaseUrl(def?.requiresBaseUrl ? def.baseUrl : "")
    setApiKey("")
    setDisplayName("")
    setDialogOpen(true)
  }

  if (isLoading) return <AppShell title="Providers"><div className="p-10 flex items-center justify-center"><Spinner className="w-6 h-6 text-indigo-600" /></div></AppShell>
  if (!data && !isLoading) return <AppShell title="Providers"><div role="alert" className="p-6 text-sm text-red-600">Unable to load providers. Please refresh and try again.</div></AppShell>

  const configuredSet = new Set(credentials.map((c) => c.providerId))
  const filteredProviders = (available as ProviderDefinition[]).filter((provider) =>
    `${provider.name} ${provider.id} ${provider.baseUrl}`.toLowerCase().includes(search.toLowerCase().trim())
  )

  return (
    <AppShell title="Providers">
      <div className="omniai-page max-w-6xl space-y-8">
        <div>
          <p className="text-gray-500 text-sm">Connect API keys for the AI providers you use. Keys are AES-256-GCM encrypted at rest and never sent to the browser in plaintext.</p>
        </div>

        {credentials.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Your Connections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {credentials.map((c) => {
                const def = PROVIDER_DEFINITIONS[c.providerId]
                return (
                  <Card key={c.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white" style={{ backgroundColor: def?.iconColor || "#6b7280" }}>
                            {def?.iconInitials || "?"}
                          </div>
                          <div>
                            <CardTitle className="text-base">{c.displayName || def?.name}</CardTitle>
                            <CardDescription>{def?.name} • {c.maskedKey}</CardDescription>
                          </div>
                        </div>
                        {c.isVerified ? (
                          <Badge variant="green" className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Connected</Badge>
                        ) : (
                          <Badge variant="red" className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Unverified</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600">
                      {c.baseUrl && <div className="text-xs font-mono bg-gray-50 rounded px-2 py-1 mb-2 truncate">{c.baseUrl}</div>}
                    </CardContent>
                    <CardFooter className="gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => testMutation.mutate(c.id)} disabled={testMutation.isPending}>
                        <RefreshCw className="w-4 h-4 mr-1" /> Test
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remove
                      </Button>
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Add a Provider <span className="text-sm font-normal text-gray-500">({filteredProviders.length})</span></h2>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search providers..."
                aria-label="Search providers"
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProviders.map((p) => {
              const configured = configuredSet.has(p.id)
              return (
                <Card key={p.id} className="hover:border-indigo-400 transition">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.iconColor }}>
                        {p.iconInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{p.name}</h3>
                          {configured && <Badge variant="green" className="text-[10px]">Added</Badge>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{p.baseUrl || "Custom endpoint"}</p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={() => openAdd(p.id)}>
                            <Plus className="w-3.5 h-3.5 mr-1" /> {configured ? "Add another key" : "Connect"}
                          </Button>
                          {p.apiKeyUrl && (
                            <a href={p.apiKeyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-gray-500 hover:text-indigo-600 px-2 py-1">
                              Get key <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {filteredProviders.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No providers match your search.</p>}
        </section>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Connect {selectedProvider && PROVIDER_DEFINITIONS[selectedProvider]?.name}
          </DialogTitle>
          <DialogClose onClick={() => setDialogOpen(false)} />
        </DialogHeader>
        <DialogContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Display name (optional)</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="My Work Key" />
            </div>
            {(() => {
              const def = PROVIDER_DEFINITIONS[selectedProvider]
              if (!def) return null
              return (
                <>
                  {(def.requiresApiKey || def.optionalApiKey) && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        API Key {def.optionalApiKey && <span className="font-normal text-gray-500">(optional)</span>}
                      </label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={def.apiKeyPlaceholder}
                        required={def.requiresApiKey}
                        autoComplete="new-password"
                      />
                      {def.apiKeyUrl && (
                        <a href={def.apiKeyUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline inline-flex items-center mt-1">
                          Get an API key <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                  )}
                  {def.requiresBaseUrl && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Base URL</label>
                      <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={def.baseUrl || "https://your-endpoint/v1"} />
                      {def.id === "ollama" && <p className="text-xs text-gray-500 mt-1">Default: http://localhost:11434</p>}
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => { setAdding(true); addMutation.mutate() }}
            disabled={adding || !selectedProvider || (Boolean(PROVIDER_DEFINITIONS[selectedProvider]?.requiresApiKey) && !apiKey.trim()) || (Boolean(PROVIDER_DEFINITIONS[selectedProvider]?.requiresBaseUrl) && !baseUrl.trim())}
          >
            {adding ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Save & Test
          </Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  )
}
