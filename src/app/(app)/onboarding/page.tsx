"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { KeyRound, ArrowRight, Sparkles } from "lucide-react"

export default function OnboardingPage() {
  const router = useRouter()
  return (
    <AppShell>
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-6 shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to OmniAI!</h1>
            <p className="text-gray-500 mb-6">
              Before you start chatting, you&apos;ll need to add at least one AI provider. Your API keys are encrypted with AES-256-GCM and never exposed to the browser.
            </p>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-sm text-indigo-900">
                  <div className="font-semibold">Connect your first provider</div>
                  <div className="text-indigo-700 text-xs mt-1">You can add OpenAI, Anthropic, Google, Groq, Ollama (local), or any OpenAI-compatible endpoint.</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Link href="/providers">
                <Button className="w-full">
                  Add a Provider <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button variant="ghost" onClick={() => router.push("/chat")}>I&apos;ll do this later</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
