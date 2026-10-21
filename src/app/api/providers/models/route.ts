import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/crypto"
import { getAdapter } from "@/lib/providers/registry"

const schema = z.object({
  providerId: z.string().min(1),
  credentialId: z.string().optional(),
})

export async function POST(req: Request) {
  const userId = await getLocalUserId()
  try {
    const body = await req.json()
    const { providerId, credentialId } = schema.parse(body)
    const adapter = getAdapter(providerId)
    let key = ""
    let baseUrl: string | undefined

    if (credentialId) {
      const cred = await prisma.providerCredential.findFirst({ where: { id: credentialId, userId } })
      if (!cred) return NextResponse.json({ error: "Credential not found", models: [] }, { status: 404 })
      if (cred.providerId !== providerId) {
        return NextResponse.json({ error: "Credential does not belong to this provider", models: [] }, { status: 400 })
      }
      key = decrypt(cred.apiKeyEncrypted, cred.apiKeyIv, cred.apiKeyTag)
      baseUrl = cred.baseUrl || undefined
    }

    if (adapter.fetchModels) {
      try {
        const models = await adapter.fetchModels(key, baseUrl)
        return NextResponse.json({ models })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load models from provider"
        const models = providerId === "ollama" ? [] : adapter.models
        return NextResponse.json({ models, warning: message })
      }
    }
    return NextResponse.json({ models: adapter.models })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load models"
    return NextResponse.json({ error: message, models: [] }, { status: 400 })
  }
}
