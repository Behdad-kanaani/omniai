import { getLocalUserId } from "@/lib/local-user"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const userId = await getLocalUserId()

  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get("days") || "30", 10)

  const since = new Date()
  since.setDate(since.getDate() - days)

  const records = await prisma.usageRecord.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  })

  const totalPromptTokens = records.reduce((s, r) => s + r.promptTokens, 0)
  const totalCompletionTokens = records.reduce((s, r) => s + r.completionTokens, 0)
  const totalCost = records.reduce((s, r) => s + r.estimatedCost, 0)
  const totalRequests = records.length

  const byProvider: Record<string, { requests: number; promptTokens: number; completionTokens: number; cost: number }> = {}
  for (const r of records) {
    const p = byProvider[r.providerId] || { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 }
    p.requests += 1
    p.promptTokens += r.promptTokens
    p.completionTokens += r.completionTokens
    p.cost += r.estimatedCost
    byProvider[r.providerId] = p
  }

  const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {}
  for (const r of records) {
    const m = byModel[r.modelId] || { requests: 0, tokens: 0, cost: 0 }
    m.requests += 1
    m.tokens += r.totalTokens
    m.cost += r.estimatedCost
    byModel[r.modelId] = m
  }
  const topModels = Object.entries(byModel)
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 10)

  const byDay: Record<string, { tokens: number; cost: number; requests: number }> = {}
  for (const r of records) {
    const d = r.createdAt.toISOString().slice(0, 10)
    const x = byDay[d] || { tokens: 0, cost: 0, requests: 0 }
    x.tokens += r.totalTokens
    x.cost += r.estimatedCost
    x.requests += 1
    byDay[d] = x
  }
  const timeline = Object.entries(byDay).map(([date, v]) => ({ date, ...v }))

  return NextResponse.json({
    summary: {
      totalRequests,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens: totalPromptTokens + totalCompletionTokens,
      totalCost,
      days,
    },
    byProvider,
    topModels,
    timeline,
  })
}
