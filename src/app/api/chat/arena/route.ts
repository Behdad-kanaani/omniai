import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import { getAdapter, estimateCost } from "@/lib/providers/registry"
import { ChatMessage } from "@/lib/providers/types"

const arenaSchema = z.object({
  conversationId: z.string().optional(),
  participants: z.array(
    z.object({
      credentialId: z.string().min(1),
      model: z.string().min(1),
    })
  ).min(2).max(4),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  title: z.string().max(200).optional(),
})

export const revalidate = 0

export async function POST(req: Request) {
  const userId = await getLocalUserId()

  let payload
  try { payload = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const parsed = arenaSchema.safeParse(payload)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const { participants, messages, temperature, maxTokens, systemPrompt, conversationId, title } = parsed.data

  const resolved = await Promise.all(
    participants.map(async (p) => {
      const cred = await prisma.providerCredential.findFirst({ where: { id: p.credentialId, userId } })
      if (!cred) throw new Error(`Credential ${p.credentialId} not found`)
      return {
        cred,
        model: p.model,
        apiKey: decrypt(cred.apiKeyEncrypted, cred.apiKeyIv, cred.apiKeyTag),
        adapter: getAdapter(cred.providerId),
      }
    })
  )

  let cid = conversationId
  if (!cid) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const autoTitle = title || (lastUser ? lastUser.content.slice(0, 60) : "Arena comparison")
    const convo = await prisma.conversation.create({
      data: {
        userId,
        title: autoTitle,
        mode: "arena",
        arenaModelIds: JSON.stringify(participants.map((p) => p.model)),
        systemPrompt: systemPrompt || null,
      },
    })
    cid = convo.id
  }

  const lastUser = messages[messages.length - 1]
  if (lastUser.role === "user") {
    await prisma.message.create({
      data: { conversationId: cid!, userId, role: "user", content: lastUser.content },
    })
  }

  const encoder = new TextEncoder()
  const assistantMsgs: Record<string, { id: string; content: string }> = {}

  const chatMessages: ChatMessage[] = []
  if (systemPrompt) chatMessages.push({ role: "system", content: systemPrompt })
  chatMessages.push(...messages)

  const stream = new ReadableStream({
    async start(controller) {
      const send = (evt: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${evt}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      send("meta", { conversationId: cid })

      for (const p of resolved) {
        const pm = await prisma.message.create({
          data: {
            conversationId: cid!,
            userId,
            role: "assistant",
            content: "",
            modelId: p.model,
            providerId: p.cred.providerId,
          },
        })
        assistantMsgs[`${p.cred.id}::${p.model}`] = { id: pm.id, content: "" }
        send("participant", { credentialId: p.cred.id, model: p.model, messageId: pm.id })
      }

      const tasks = resolved.map(async (p) => {
        const key = `${p.cred.id}::${p.model}`
        let content = ""
        let promptTk = 0, compTk = 0
        try {
          for await (const chunk of p.adapter.streamChat({
            model: p.model,
            messages: chatMessages,
            temperature,
            maxTokens,
            stream: true,
            apiKey: p.apiKey,
            baseUrl: p.cred.baseUrl || undefined,
          })) {
            if (chunk.type === "delta" && chunk.content) {
              content += chunk.content
              send("delta", { credentialId: p.cred.id, model: p.model, content: chunk.content })
            } else if (chunk.type === "usage" && chunk.usage) {
              promptTk = chunk.usage.promptTokens
              compTk = chunk.usage.completionTokens
              send("usage", { credentialId: p.cred.id, model: p.model, usage: chunk.usage })
            } else if (chunk.type === "error") {
              send("error", { credentialId: p.cred.id, model: p.model, error: chunk.error })
            }
          }
        } catch (error: unknown) {
          send("error", { credentialId: p.cred.id, model: p.model, error: error instanceof Error ? error.message : "Stream failed" })
        } finally {
          const msgId = assistantMsgs[key]?.id
          if (msgId) {
            await prisma.message.update({
              where: { id: msgId },
              data: {
                content,
                promptTokens: promptTk,
                completionTokens: compTk,
                totalTokens: promptTk + compTk,
              },
            })
          }
          const cost = estimateCost(p.cred.providerId, p.model, { promptTokens: promptTk, completionTokens: compTk })
          await prisma.usageRecord.create({
            data: {
              userId,
              conversationId: cid!,
              providerId: p.cred.providerId,
              modelId: p.model,
              promptTokens: promptTk,
              completionTokens: compTk,
              totalTokens: promptTk + compTk,
              estimatedCost: cost,
            },
          })
          send("done", { credentialId: p.cred.id, model: p.model })
        }
      })

      await Promise.all(tasks)
      await prisma.conversation.update({ where: { id: cid! }, data: { updatedAt: new Date() } })
      send("complete", { conversationId: cid })
      controller.close()
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
