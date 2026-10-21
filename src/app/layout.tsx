import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/lib/session-provider"
import { Toaster } from "@/components/ui/toast"

export const metadata: Metadata = {
  title: "OmniAI — Multi-Provider AI Playground",
  description: "One chat UI for every major AI model. Compare providers, keep your keys encrypted, and own your history.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
