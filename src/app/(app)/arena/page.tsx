"use client"
import { AppShell } from "@/components/layout/app-shell"
import { ArenaPanel } from "@/components/chat/arena-panel"
import { useEffect } from "react"
import { useChatStore } from "@/store/chat"

export default function ArenaPage() {
  const setArenaMode = useChatStore((s) => s.setArenaMode)
  useEffect(() => { setArenaMode(true) }, [setArenaMode])
  return (
    <AppShell>
      <ArenaPanel />
    </AppShell>
  )
}
