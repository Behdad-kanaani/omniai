"use client"
import { create } from "zustand"

export interface UiMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  modelId?: string
  providerId?: string
  streaming?: boolean
  error?: string
  agentTrace?: { phase: string; detail: string; step: number }[]
  participantKey?: string
}

interface ParticipantState {
  credentialId: string
  model: string
  content: string
  streaming: boolean
  error?: string
  messageId?: string
}

interface ChatState {
  conversationId: string | null
  messages: UiMessage[]
  isStreaming: boolean
  selectedCredentialId: string | null
  selectedModel: string | null
  systemPrompt: string
  temperature: number
  maxTokens: number

  arenaMode: boolean
  arenaParticipants: { credentialId: string; model: string }[]
  arenaOutputs: Record<string, ParticipantState>

  setConversation: (id: string | null) => void
  setMessages: (m: UiMessage[]) => void
  addMessage: (m: UiMessage) => void
  updateAssistant: (id: string, updater: (m: UiMessage) => UiMessage) => void
  setStreaming: (s: boolean) => void
  setSelectedCredential: (id: string | null) => void
  setSelectedModel: (m: string | null) => void
  setSystemPrompt: (s: string) => void
  setTemperature: (n: number) => void
  setMaxTokens: (n: number) => void
  setArenaMode: (on: boolean) => void
  setArenaParticipants: (ps: { credentialId: string; model: string }[]) => void
  initArena: () => void
  updateArenaParticipant: (credentialId: string, model: string, patch: Partial<ParticipantState>) => void
  reset: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversationId: null,
  messages: [],
  isStreaming: false,
  selectedCredentialId: null,
  selectedModel: null,
  systemPrompt: "",
  temperature: 0.7,
  maxTokens: 4096,
  arenaMode: false,
  arenaParticipants: [],
  arenaOutputs: {},

  setConversation: (id) => set({ conversationId: id }),
  setMessages: (m) => set({ messages: m }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  updateAssistant: (id, updater) => set((s) => ({
    messages: s.messages.map((m) => (m.id === id ? updater(m) : m)),
  })),
  setStreaming: (s) => set({ isStreaming: s }),
  setSelectedCredential: (id) => set({ selectedCredentialId: id }),
  setSelectedModel: (m) => set({ selectedModel: m }),
  setSystemPrompt: (s) => set({ systemPrompt: s }),
  setTemperature: (n) => set({ temperature: n }),
  setMaxTokens: (n) => set({ maxTokens: n }),
  setArenaMode: (on) => set({ arenaMode: on }),
  setArenaParticipants: (ps) => set({ arenaParticipants: ps }),
  initArena: () => set((s) => {
    const out: Record<string, ParticipantState> = {}
    for (const p of s.arenaParticipants) {
      out[`${p.credentialId}::${p.model}`] = {
        credentialId: p.credentialId,
        model: p.model,
        content: "",
        streaming: true,
      }
    }
    return { arenaOutputs: out, isStreaming: true }
  }),
  updateArenaParticipant: (credentialId, model, patch) => set((s) => {
    const key = `${credentialId}::${model}`
    return { arenaOutputs: { ...s.arenaOutputs, [key]: { ...s.arenaOutputs[key], ...patch, credentialId, model } } }
  }),
  clearMessages: () => set({ messages: [], arenaOutputs: {}, conversationId: null }),
  reset: () => set({
    conversationId: null,
    messages: [],
    isStreaming: false,
    arenaOutputs: {},
  }),
}))
