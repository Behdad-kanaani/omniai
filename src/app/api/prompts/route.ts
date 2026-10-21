import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"

const promptSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  isFavorite: z.boolean().optional(),
})

export async function GET() {
  const userId = await getLocalUserId()
  const prompts = await prisma.prompt.findMany({ where: { userId }, orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }] })
  return NextResponse.json({ prompts })
}

export async function POST(req: Request) {
  const userId = await getLocalUserId()
  try {
    const body = await req.json()
    const parsed = promptSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    const p = await prisma.prompt.create({ data: { ...parsed.data, userId } })
    return NextResponse.json({ prompt: p })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create prompt" }, { status: 500 })
  }
}
