import "server-only"
import { prisma } from "@/lib/prisma"

const LOCAL_ID = "omniai-local-owner"

export async function getLocalUserId(): Promise<string> {
  await prisma.user.upsert({
    where: { id: LOCAL_ID },
    update: {},
    create: { id: LOCAL_ID, name: "Local User", email: "local@omniai.invalid" },
  })
  return LOCAL_ID
}
