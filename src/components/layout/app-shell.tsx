"use client"
import * as React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./sidebar"
import { Header } from "./header"

const pageTitles: Record<string, string> = {
  "/chat": "Chat",
  "/arena": "Model Arena",
  "/history": "Conversation history",
  "/prompts": "Prompt library",
  "/providers": "Providers",
  "/analytics": "Usage analytics",
  "/settings": "Settings",
  "/onboarding": "Welcome to OmniAI",
}

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  React.useEffect(() => {
    if (!mobileNavOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [mobileNavOpen])

  return (
    <div className="flex h-dvh overflow-hidden omniai-shell">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          aria-controls="primary-navigation"
          className="fixed inset-0 z-50 bg-slate-950/45 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title={title || pageTitles[pathname] || "OmniAI"}
          menuOpen={mobileNavOpen}
          onMenuClick={() => setMobileNavOpen((open) => !open)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
