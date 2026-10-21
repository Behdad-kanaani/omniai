"use client"
import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { BookOpen, Plus, Star, Trash2, Copy, Pencil } from "lucide-react"
import { toast } from "@/components/ui/toast"

const PRESET_PROMPTS = [
  { title: "Code Reviewer", description: "Review code for bugs & style", content: "You are a meticulous senior software engineer. Review the following code for bugs, edge cases, security issues, and style problems. Be specific and constructive." },
  { title: "Explain Like I'm 5", description: "Simple explanations", content: "Explain the following concept in simple, friendly language that a bright 5-year-old could understand. Use analogies from everyday life." },
  { title: "Email Draft", description: "Professional emails", content: "Write a concise, professional email based on the notes below. Keep it warm but direct, and use proper formatting." },
  { title: "Brainstorm Ideas", description: "Creative ideas", content: "Generate 10 creative, specific ideas on the topic below. Avoid clichés. For each, give a one-sentence pitch and a potential angle." },
  { title: "Summarize Text", description: "Concise summary", content: "Summarize the text below in 3 bullet points of at most 20 words each, followed by a one-sentence TL;DR." },
  { title: "Debug Assistant", description: "Help debug errors", content: "You are an expert debugger. Given the error message and code below, identify the most likely root cause and propose a fix, explaining why it works." },
]

interface Prompt {
  id: string
  title: string
  content: string
  description: string | null
  category: string | null
  isFavorite: boolean
}

interface PromptsResponse {
  prompts: Prompt[]
}

export default function PromptsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery<PromptsResponse>({
    queryKey: ["prompts"],
    queryFn: async () => {
      const response = await fetch("/api/prompts")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load prompts")
      return result as PromptsResponse
    },
  })
  const [open, setOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [category, setCategory] = React.useState("")

  const prompts = data?.prompts || []

  const create = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/api/prompts/${editingId}` : "/api/prompts"
      const method = editingId ? "PATCH" : "POST"
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content, description, category }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to save prompt")
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prompts"] })
      setOpen(false); reset(); toast(editingId ? "Updated" : "Saved", "success")
    },
    onError: (error: unknown) => toast(error instanceof Error ? error.message : "Unable to save prompt", "error"),
  })
  const del = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/prompts/${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Unable to delete prompt")
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prompts"] }); toast("Deleted", "success") },
    onError: (error: unknown) => toast(error instanceof Error ? error.message : "Unable to delete prompt", "error"),
  })
  const toggleFav = useMutation({
    mutationFn: async (p: Prompt) => {
      const response = await fetch(`/api/prompts/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isFavorite: !p.isFavorite }) })
      if (!response.ok) throw new Error("Unable to update favorite")
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
    onError: (error: unknown) => toast(error instanceof Error ? error.message : "Unable to update favorite", "error"),
  })

  const reset = () => { setTitle(""); setContent(""); setDescription(""); setCategory(""); setEditingId(null) }
  const openEdit = (p: Prompt) => { setEditingId(p.id); setTitle(p.title); setContent(p.content); setDescription(p.description || ""); setCategory(p.category || ""); setOpen(true) }
  const openNew = () => { reset(); setOpen(true) }
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast("Copied", "success"))
      .catch(() => toast("Unable to copy prompt", "error"))
  }
  const closeDialog = () => { setOpen(false); reset() }
  const applyPreset = (p: typeof PRESET_PROMPTS[0]) => {
    reset()
    setTitle(p.title)
    setContent(p.content)
    setDescription(p.description)
    setOpen(true)
  }

  return (
    <AppShell title="Prompt Library">
      <div className="omniai-page max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm">Save and organize your best prompts for reuse.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New prompt</Button>
        </div>

        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-amber-500" /> Starters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PRESET_PROMPTS.map((p) => (
              <button
                type="button"
                key={p.title}
                className="prompt-starter w-full rounded-2xl text-left"
                onClick={() => applyPreset(p)}
              >
                <CardContent className="p-4">
                  <h3 className="font-medium text-gray-900">{p.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                </CardContent>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Your Library</h2>
          {isLoading ? <Spinner className="w-5 h-5 text-indigo-600" /> : isError ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
              Prompts could not be loaded.{" "}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => refetch()}>Try again</button>
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-300">
              No saved prompts yet. Save your best prompts to reuse them anytime.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {prompts.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{p.title}</h3>
                          {p.isFavorite && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                          {p.category && <Badge variant="gray">{p.category}</Badge>}
                        </div>
                        {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
                        <div className="mt-2 text-sm text-gray-700 bg-gray-50 rounded p-2 line-clamp-3 whitespace-pre-wrap">{p.content}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" aria-label={p.isFavorite ? `Remove ${p.title} from favorites` : `Add ${p.title} to favorites`} onClick={() => toggleFav.mutate(p)}>
                          <Star className={`w-4 h-4 ${p.isFavorite ? "fill-amber-500 text-amber-500" : ""}`} />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Copy ${p.title}`} onClick={() => copy(p.content)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Edit ${p.title}`} onClick={() => openEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label={`Delete ${p.title}`} disabled={del.isPending} className="text-red-600 hover:bg-red-50" onClick={() => del.mutate(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (o) setOpen(true); else closeDialog() }}>
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Prompt" : "New Prompt"}</DialogTitle>
          <DialogClose onClick={closeDialog} />
        </DialogHeader>
        <DialogContent>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Prompt title" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Category</label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Coding, Writing" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Content</label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Your prompt..." />
            </div>
          </div>
        </DialogContent>
        <DialogFooter>
          <Button variant="outline" onClick={closeDialog}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!title || !content}>{editingId ? "Save" : "Create"}</Button>
        </DialogFooter>
      </Dialog>
    </AppShell>
  )
}
