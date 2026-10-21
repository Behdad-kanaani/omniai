"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Swords,
  KeyRound,
  BookOpen,
  History,
  BarChart3,
  Settings,
  Sparkles,
  FolderCode,
  Plus,
} from "lucide-react"
import { useChatStore } from "@/store/chat"
import { useQuery } from "@tanstack/react-query"

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/arena", label: "Arena", icon: Swords },
  { href: "/history", label: "History", icon: History },
  { href: "/prompts", label: "Prompts", icon: BookOpen },
  { href: "/providers", label: "Providers", icon: KeyRound },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
]

interface ConversationSummary {
  id: string
  title: string
  mode: string
}

async function fetchConversations() {
  const res = await fetch("/api/conversations")
  if (!res.ok) throw new Error("Unable to load recent conversations")
  const data = await res.json()
  return (data.conversations || []) as ConversationSummary[]
}

interface SidebarProps {
  mobileOpen: boolean
  onNavigate: () => void
}

export function Sidebar({ mobileOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const clearMessages = useChatStore((s) => s.clearMessages)
  const conversationId = useChatStore((s) => s.conversationId)
  const setArenaMode = useChatStore((s) => s.setArenaMode)
  const { data: conversations = [], isError } = useQuery({
    queryKey: ["conversations-list"],
    queryFn: fetchConversations,
    enabled: true,
  })

  const recent = conversations.slice(0, 10)

  return (
    <aside
      id="primary-navigation"
      aria-label="Primary navigation"
      className={cn(
        "omniai-sidebar flex h-full shrink-0 flex-col overflow-y-auto text-gray-200",
        mobileOpen ? "is-open" : "is-closed"
      )}
    >
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <Link href="/chat" onClick={onNavigate} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="sidebar-label font-bold tracking-tight text-[19px] text-white">OmniAI <span className="text-[9px] text-violet-300 align-super">STUDIO</span></span>
        </Link>
      </div>

      <div className="p-3 pt-5">
        <Link
          href="/chat"
          onClick={() => { clearMessages(); setArenaMode(false); onNavigate() }}
          className="new-chat-link flex items-center gap-3 w-full rounded-xl border border-white/10 bg-white/10 hover:bg-white/15 px-3 py-3 text-sm font-semibold text-white transition"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Link>
      </div>

      <div className="sidebar-label px-5 pb-2 pt-5 text-[10px] font-bold uppercase tracking-[.19em] text-slate-500">Explore</div><nav aria-label="Main navigation" className="space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-xl transition",
                active
                  ? "bg-indigo-400/15 text-white ring-1 ring-indigo-300/15 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-recent px-3 mt-7">
        <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500 px-3 mb-3">Recent</div>
        <div className="space-y-0.5 overflow-y-auto max-h-[40vh]">
          {isError ? (
            <div role="alert" className="px-2 py-2 text-xs text-rose-300">Unable to load conversations</div>
          ) : recent.length === 0 ? (
            <div className="px-2 py-2 text-xs text-gray-600">No conversations yet</div>
          ) : null}
          {recent.map((c) => (
            <Link
              key={c.id}
              href={c.mode === "arena" ? "/arena" : "/chat"}
              onClick={() => { useChatStore.getState().setConversation(c.id); onNavigate() }}
              className={cn(
                "block px-3 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-white/10 rounded-xl truncate transition",
                conversationId === c.id && "bg-white/10 text-white"
              )}
              title={c.title}
            >
              {c.mode === "arena" ? "Arena: " : ""}{c.title}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto px-3 py-4 border-t border-white/10"><div className="sidebar-recent flex items-center gap-3 mx-1 mb-3 p-3 rounded-xl border border-white/10 bg-white/5"><div className="rounded-lg bg-indigo-400/10 p-2 text-indigo-300"><FolderCode className="h-4 w-4"/></div><div><div className="text-xs font-semibold text-slate-200">Workspace agent</div><div className="text-[10px] text-slate-500">Local project tools</div></div></div>
        <Link href="/providers" onClick={onNavigate} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition hover:bg-white/10 hover:text-white">
          <KeyRound className="w-4 h-4" />
          Configure Providers
        </Link>
      </div>
    </aside>
  )
}
