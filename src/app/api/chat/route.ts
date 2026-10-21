import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import { getAdapter, estimateCost } from "@/lib/providers/registry"
import { ChatMessage } from "@/lib/providers/types"
import { runAgent } from "@/lib/agent/runtime"

const chatSchema = z.object({
  conversationId: z.string().optional(),
  credentialId: z.string().min(1),
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  title: z.string().max(200).optional(),
  agentMode: z.boolean().optional(),
  workspacePath: z.string().max(1200).optional(),
})

export const revalidate = 0

export async function POST(req: Request) {
  const origin = req.headers.get("origin")
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "Cross-origin requests are blocked" }, { status: 403 })
  const userId = await getLocalUserId()

  let payload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = chatSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Bad request" }, { status: 400 })
  }
  const { credentialId, model, messages, temperature, maxTokens, systemPrompt, conversationId, title, agentMode, workspacePath } = parsed.data

  const cred = await prisma.providerCredential.findFirst({
    where: { id: credentialId, userId },
  })
  if (!cred) return NextResponse.json({ error: "Credential not found" }, { status: 404 })

  const apiKey = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv, cred.apiKeyTag)
  const adapter = getAdapter(cred.providerId)

  let conversationId0 = conversationId
  if (!conversationId0) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const autoTitle = title || (lastUser ? lastUser.content.slice(0, 60) : "New conversation")
    const convo = await prisma.conversation.create({
      data: {
        userId,
        providerId: cred.providerId,
        modelId: model,
        credentialId: cred.id,
        title: autoTitle,
        mode: agentMode ? "agent" : "chat",
        systemPrompt: systemPrompt || null,
      },
    })
    conversationId0 = convo.id
  } else {
    const existing = await prisma.conversation.findFirst({ where: { id: conversationId0, userId } })
    if (!existing) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    await prisma.conversation.update({
      where: { id: conversationId0 },
      data: { providerId: cred.providerId, modelId: model, credentialId: cred.id, systemPrompt: systemPrompt || existing.systemPrompt },
    })
  }

  const lastMsg = messages[messages.length - 1]
  if (lastMsg.role === "user") {
    await prisma.message.create({
      data: {
        conversationId: conversationId0,
        userId,
        role: "user",
        content: lastMsg.content,
        modelId: model,
        providerId: cred.providerId,
      },
    })
  }

  const chatMessages: ChatMessage[] = []
  const effectiveSystem = systemPrompt || (await prisma.conversation.findUnique({ where: { id: conversationId0 } }))?.systemPrompt
  if (effectiveSystem) chatMessages.push({ role: "system", content: effectiveSystem })
  chatMessages.push(...messages)

  const encoder = new TextEncoder()
  let assistantContent = ""
  let promptTokens = 0
  let completionTokens = 0
  let assistantMessageId: string | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      send("meta", { conversationId: conversationId0 })

      const assistantMsg = await prisma.message.create({
        data: {
          conversationId: conversationId0!,
          userId,
          role: "assistant",
          content: "",
          modelId: model,
          providerId: cred.providerId,
        },
      })
      assistantMessageId = assistantMsg.id
      send("meta", { assistantMessageId })

      try {
        if (agentMode) {
          const output = await runAgent({ adapter, model, apiKey, baseUrl: cred.baseUrl || undefined, messages: chatMessages, temperature, maxTokens, workspacePath, emit: (event) => send("agent", event) })
          assistantContent = output.response
          promptTokens = output.promptTokens
          completionTokens = output.completionTokens
          send("delta", { content: assistantContent })
          send("usage", { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens })
        } else for await (const chunk of adapter.streamChat({
          model,
          messages: chatMessages,
          temperature,
          maxTokens,
          stream: true,
          apiKey,
          baseUrl: cred.baseUrl || undefined,
        })) {
          if (chunk.type === "delta" && chunk.content) {
            assistantContent += chunk.content
            send("delta", { content: chunk.content })
          } else if (chunk.type === "usage" && chunk.usage) {
            promptTokens = chunk.usage.promptTokens
            completionTokens = chunk.usage.completionTokens
            send("usage", chunk.usage)
          } else if (chunk.type === "error") {
            send("error", { error: chunk.error })
          }
        }
      } catch (error: unknown) {
        send("error", { error: error instanceof Error ? error.message : "Stream failed" })
      } finally {
        if (assistantMessageId) {
          await prisma.message.update({
            where: { id: assistantMessageId },
            data: {
              content: assistantContent,
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          })
        }
        const cost = estimateCost(cred.providerId, model, { promptTokens, completionTokens })
        await prisma.usageRecord.create({
          data: {
            userId,
            conversationId: conversationId0!,
            providerId: cred.providerId,
            modelId: model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            estimatedCost: cost,
          },
        })
        await prisma.conversation.update({
          where: { id: conversationId0! },
          data: { updatedAt: new Date() },
        })
        send("done", { conversationId: conversationId0, assistantMessageId })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
