"use client"
import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { PROVIDER_DEFINITIONS } from "@/lib/providers/registry"
import { formatNumber, formatCurrency } from "@/lib/utils"
import { BarChart3, DollarSign, MessageSquare, Hash } from "lucide-react"

interface UsageData {
  summary: {
    totalRequests: number
    totalTokens: number
    totalCost: number
    totalPromptTokens: number
    totalCompletionTokens: number
    days: number
  }
  byProvider: Record<string, { requests: number; cost: number }>
  topModels: { model: string; requests: number; tokens: number; cost: number }[]
  timeline: { date: string; tokens: number }[]
}

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery<UsageData>({
    queryKey: ["usage"],
    queryFn: async (): Promise<UsageData> => {
      const response = await fetch("/api/usage?days=30")
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Unable to load usage data")
      return result as UsageData
    },
  })

  if (isLoading) return <AppShell title="Analytics"><div className="p-10 flex items-center justify-center"><Spinner className="w-6 h-6 text-indigo-600" /></div></AppShell>
  if (isError) return <AppShell title="Analytics"><div role="alert" className="omniai-page max-w-6xl"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">Usage data could not be loaded. <button type="button" className="ml-2 font-semibold underline underline-offset-2" onClick={() => refetch()}>Try again</button></div></div></AppShell>

  const s = data?.summary || { totalRequests: 0, totalTokens: 0, totalCost: 0, totalPromptTokens: 0, totalCompletionTokens: 0, days: 30 }
  const byProvider = data?.byProvider || {}
  const topModels = data?.topModels || []
  const timeline = data?.timeline || []

  const maxDayTokens = Math.max(1, ...timeline.map((t) => t.tokens))
  const maxProviderReq = Math.max(1, ...Object.values(byProvider).map((provider) => provider.requests))

  return (
    <AppShell title="Analytics">
      <div className="omniai-page max-w-6xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<MessageSquare className="w-5 h-5" />} label="Total Requests" value={s.totalRequests.toLocaleString()} color="indigo" />
          <StatCard icon={<Hash className="w-5 h-5" />} label="Total Tokens" value={formatNumber(s.totalTokens)} color="purple" hint={`${formatNumber(s.totalPromptTokens)} in • ${formatNumber(s.totalCompletionTokens)} out`} />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Estimated Cost" value={formatCurrency(s.totalCost)} color="green" hint="Approx, based on list prices" />
          <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Active Days" value={timeline.length.toString()} color="amber" hint={`Last ${s.days} days`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage Over Time</CardTitle>
              <CardDescription>Tokens per day, last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No data yet</div>
              ) : (
                <div className="flex items-end gap-1 h-48">
                  {timeline.map((t) => (
                    <div key={t.date} className="flex-1 flex flex-col items-center group">
                      <div className="w-full bg-indigo-100 rounded-t relative" style={{ height: `${(t.tokens / maxDayTokens) * 100}%` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t opacity-90" />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] bg-gray-900 text-white rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                          {formatNumber(t.tokens)} tokens
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Provider</CardTitle>
              <CardDescription>Requests per provider</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(byProvider).length === 0 ? (
                <div className="text-center py-10 text-sm text-gray-400">No data yet</div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(byProvider).map(([pid, stats]) => {
                    const def = PROVIDER_DEFINITIONS[pid]
                    return (
                      <div key={pid}>
                        <div className="flex items-center justify-between mb-1 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: def?.iconColor || "#888" }}>{def?.iconInitials || "?"}</div>
                            <span className="font-medium">{def?.name || pid}</span>
                          </div>
                          <div className="text-gray-500 text-xs">{stats.requests} req • {formatCurrency(stats.cost)}</div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(stats.requests / maxProviderReq) * 100}%`, backgroundColor: def?.iconColor || "#6366f1" }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Models</CardTitle>
            <CardDescription>Most-used models by token volume</CardDescription>
          </CardHeader>
          <CardContent>
            {topModels.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-400">No data yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b">
                      <th className="pb-2 font-medium">Model</th>
                      <th className="pb-2 font-medium text-right">Requests</th>
                      <th className="pb-2 font-medium text-right">Tokens</th>
                      <th className="pb-2 font-medium text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topModels.map((m) => (
                      <tr key={m.model} className="border-b last:border-0">
                        <td className="py-2 font-mono text-xs"><Badge variant="gray">{m.model}</Badge></td>
                        <td className="py-2 text-right">{m.requests}</td>
                        <td className="py-2 text-right">{formatNumber(m.tokens)}</td>
                        <td className="py-2 text-right text-green-700 font-medium">{formatCurrency(m.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function StatCard({ icon, label, value, color, hint }: { icon: React.ReactNode; label: string; value: string; color: "indigo" | "purple" | "green" | "amber"; hint?: string }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
  }
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>{icon}</div>
          <div>
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
            {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
