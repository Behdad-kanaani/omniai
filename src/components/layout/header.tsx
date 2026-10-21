"use client"
import Link from "next/link"
import { Menu, Settings, ShieldCheck, X } from "lucide-react"

interface HeaderProps {
  title?: string
  menuOpen: boolean
  onMenuClick: () => void
}

export function Header({ title, menuOpen, onMenuClick }: HeaderProps) {
  return (
    <header className="omniai-header flex shrink-0 items-center justify-between gap-3 px-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700 md:hidden"
        >
          {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400 sm:block">OmniAI workspace</p>
          <h1 className="truncate text-[15px] font-semibold text-slate-900 md:text-base">{title || "OmniAI"}</h1>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 md:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" />
          Local-first
        </span>
        <Link
          href="/settings"
          aria-label="Open settings"
          title="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}
