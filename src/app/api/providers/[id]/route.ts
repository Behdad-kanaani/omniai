import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getLocalUserId()
  try {
    const { id } = await params
    const existing = await prisma.providerCredential.findFirst({
      where: { id, userId },
    })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    await prisma.providerCredential.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 500 })
  }
}
