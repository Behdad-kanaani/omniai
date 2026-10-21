"use client"
import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { PROVIDER_DEFINITIONS } from "@/lib/providers/registry"
import { relativeTime } from "@/lib/utils"
import { Trash2, MessageSquare, Swords, ExternalLink } from "lucide-react"
import { toast } from "@/components/ui/toast"
import Link from "next/link"

interface ConversationSummary {
  id: string
  title: string
  mode: string
  providerId: string | null
  modelId: string | null
  arenaModelIds: string | null
  updatedAt: string
  _count: { messages: number }
}

interface HistoryResponse {
  conversations: ConversationSummary[]
}

export default function HistoryPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery<HistoryResponse>({
    queryKey: ["history"],
    queryFn: async () => {
      const r = await fetch("/api/conversations")
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || "Unable to load conversation history")
      return result as HistoryResponse
    },
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/conversations?id=${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Unable to delete conversation")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history"] })
      qc.invalidateQueries({ queryKey: ["conversations-list"] })
      toast("Deleted", "success")
    },
    onError: (error: unknown) => toast(error instanceof Error ? error.message : "Unable to delete conversation", "error"),
  })

  const convos = data?.conversations || []

  return (
    <AppShell title="History">
      <div className="omniai-page max-w-4xl space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Spinner className="w-6 h-6 text-indigo-600" /></div>
        ) : isError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
            <p>Conversation history could not be loaded.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : convos.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">No conversations yet</h2>
            <p className="text-gray-500 mt-1 mb-4">Start chatting and your history will appear here.</p>
            <Link href="/chat"><Button>Start a chat</Button></Link>
          </div>
        ) : (
          <div className="space-y-2">
            {convos.map((c) => {
              const def = c.providerId ? PROVIDER_DEFINITIONS[c.providerId] : null
              return (
                <Card key={c.id} className="hover:shadow-md transition">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="shrink-0">
                      {c.mode === "arena" ? (
                        <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                          <Swords className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: def?.iconColor || "#6366f1" }}>
                          {def?.iconInitials || "AI"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{c.title}</h3>
                        {c.mode === "arena" ? <Badge variant="purple">Arena</Badge> : def && <Badge variant="gray">{def.name}</Badge>}
                        {c.modelId && !c.arenaModelIds && <Badge variant="gray">{c.modelId}</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c._count.messages} messages • {relativeTime(c.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={c.mode === "arena" ? `/arena` : `/chat?c=${c.id}`}
                        aria-label={`Open ${c.title}`}
                        title={`Open ${c.title}`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-indigo-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${c.title}`} disabled={del.isPending} className="text-red-600 hover:bg-red-50" onClick={() => del.mutate(c.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
