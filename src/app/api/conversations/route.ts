import { getLocalUserId } from "@/lib/local-user"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const userId = await getLocalUserId()

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode")

  const where: Prisma.ConversationWhereInput = { userId }
  if (mode) where.mode = mode

  const convos = await prisma.conversation.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
    take: 100,
  })

  return NextResponse.json({ conversations: convos })
}

export async function DELETE(req: Request) {
  const userId = await getLocalUserId()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  await prisma.conversation.deleteMany({ where: { id, userId } })
  return NextResponse.json({ ok: true })
}
