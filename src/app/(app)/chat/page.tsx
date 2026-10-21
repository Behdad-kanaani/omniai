"use client"
import { AppShell } from "@/components/layout/app-shell"
import { ChatPanel } from "@/components/chat/chat-panel"
import { useEffect } from "react"
import { useChatStore } from "@/store/chat"

export default function ChatPage() {
  const setArenaMode = useChatStore((s) => s.setArenaMode)
  const setConversation = useChatStore((s) => s.setConversation)
  useEffect(() => {
    setArenaMode(false)
    const conversationId = new URLSearchParams(window.location.search).get("c")
    if (conversationId) setConversation(conversationId)
  }, [setArenaMode, setConversation])
  return (
    <AppShell>
      <ChatPanel />
    </AppShell>
  )
}
