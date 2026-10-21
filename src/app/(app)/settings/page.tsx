"use client"
import * as React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Lock, Database, Shield, Info } from "lucide-react"

export default function SettingsPage() {
  const initials = "L"

  return (
    <AppShell title="Settings">
      <div className="omniai-page max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>No account or sign-in required</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar  fallback={initials} className="w-16 h-16 text-lg" />
            <div>
              <div className="font-semibold text-lg">Local User</div>
              <div className="text-sm text-gray-500">On-device workspace</div>
              <Badge variant="green" className="mt-1">Local</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-indigo-600" /> Security & Privacy</CardTitle>
            <CardDescription>How your data is handled</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">API Keys Encrypted At Rest</div>
                <div className="text-sm text-gray-500">
                  Your API keys are encrypted with AES-256-GCM using a server-side master key. They are never returned to the browser in plaintext.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Local-First Data</div>
                <div className="text-sm text-gray-500">
                  Chat history and prompts are stored in your private database; the database stays on this device.
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-sm">Direct Provider Calls</div>
                <div className="text-sm text-gray-500">
                  When you send a chat, OmniAI streams the request directly from server to the provider&apos;s API using your key. Cloud providers may process requests according to their policies.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>


      </div>
    </AppShell>
  )
}
