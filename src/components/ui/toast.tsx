"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Info, X } from "lucide-react"

type Toast = { id: number; type: "success" | "error" | "info"; message: string }
let pushFn: ((t: Omit<Toast, "id">) => void) | null = null

export function toast(message: string, type: "success" | "error" | "info" = "info") {
  pushFn?.({ type, message })
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  React.useEffect(() => {
    pushFn = (t) => {
      const id = Date.now() + Math.random()
      setToasts((cur) => [...cur, { id, ...t }])
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4000)
    }
    return () => { pushFn = null }
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "flex items-start gap-2 rounded-md border px-4 py-3 shadow-lg bg-white toast-enter",
            t.type === "success" && "border-green-200",
            t.type === "error" && "border-red-200",
            t.type === "info" && "border-gray-200"
          )}
        >
          {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />}
          {t.type === "error" && <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
          {t.type === "info" && <Info className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />}
          <div className="text-sm text-gray-800 flex-1">{t.message}</div>
          <button onClick={() => setToasts((c) => c.filter((x) => x.id !== t.id))} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
