import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import { getAdapter } from "@/lib/providers/registry"

const schema = z.object({ credentialId: z.string().min(1) })

export async function POST(req: Request) {
  const userId = await getLocalUserId()
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 })

    const cred = await prisma.providerCredential.findFirst({
      where: { id: parsed.data.credentialId, userId },
    })
    if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const key = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv, cred.apiKeyTag)
    const adapter = getAdapter(cred.providerId)
    const result = await adapter.validateKey(key, cred.baseUrl || undefined)
    await prisma.providerCredential.update({
      where: { id: cred.id },
      data: { isVerified: result.valid },
    })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test failed"
    return NextResponse.json({ valid: false, error: message }, { status: 200 })
  }
}
