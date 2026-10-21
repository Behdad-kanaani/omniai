import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getLocalUserId()
  const { id } = await params
  const convo = await prisma.conversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!convo) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ conversation: convo })
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  systemPrompt: z.string().optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getLocalUserId()
  try {
    const { id } = await params
    const body = await req.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 })
    const existing = await prisma.conversation.findFirst({ where: { id, userId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const updated = await prisma.conversation.update({
      where: { id },
      data: parsed.data,
    })
    return NextResponse.json({ conversation: updated })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update conversation" }, { status: 500 })
  }
}
