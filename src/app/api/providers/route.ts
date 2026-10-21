import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { getAllProviders, getAdapter } from "@/lib/providers/registry"
import { maskApiKey } from "@/lib/utils"

export async function GET() {
  const userId = await getLocalUserId()

  const creds = await prisma.providerCredential.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  })

  const credentials = creds.map((c) => {
    let masked = ""
    try {
      const plain = decrypt(c.apiKeyEncrypted, c.apiKeyIv, c.apiKeyTag)
      masked = maskApiKey(plain)
    } catch {
      masked = "****"
    }
    return {
      id: c.id,
      providerId: c.providerId,
      displayName: c.displayName,
      baseUrl: c.baseUrl,
      isVerified: c.isVerified,
      maskedKey: masked,
      createdAt: c.createdAt,
    }
  })

  return NextResponse.json({
    available: getAllProviders(),
    credentials,
  })
}

const addSchema = z.object({
  providerId: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().url("Base URL must be a valid URL").optional().or(z.literal("")),
  displayName: z.string().max(100).optional(),
})

export async function POST(req: Request) {
  const userId = await getLocalUserId()
  try {
    const body = await req.json()
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
    const { providerId, apiKey = "", baseUrl = "", displayName } = parsed.data
    const def = getAllProviders().find((p) => p.id === providerId)
    if (!def) return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
    const normalizedApiKey = apiKey.trim()
    if (def.requiresApiKey && !normalizedApiKey) return NextResponse.json({ error: "API key is required for this provider" }, { status: 400 })

    const effectiveBase = baseUrl || def.baseUrl
    if (def.requiresBaseUrl && !effectiveBase) {
      return NextResponse.json({ error: "Base URL is required for this provider" }, { status: 400 })
    }
    const adapter = getAdapter(providerId)
    const val = await adapter.validateKey(normalizedApiKey, effectiveBase || undefined)

    const { encrypted, iv, tag } = encrypt(normalizedApiKey)
    const cred = await prisma.providerCredential.create({
      data: {
        userId,
        providerId,
        displayName: displayName || null,
        apiKeyEncrypted: encrypted,
        apiKeyIv: iv,
        apiKeyTag: tag,
        baseUrl: effectiveBase || null,
        isVerified: val.valid,
      },
    })

    return NextResponse.json({
      credential: {
        id: cred.id,
        providerId: cred.providerId,
        displayName: cred.displayName,
        baseUrl: cred.baseUrl,
        isVerified: cred.isVerified,
        maskedKey: maskApiKey(normalizedApiKey),
      },
      validation: val,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add provider"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
