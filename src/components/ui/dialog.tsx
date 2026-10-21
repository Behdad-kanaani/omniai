"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DialogProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  children: React.ReactNode
}
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false) }
    if (open) document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between p-5 border-b", className)}>{children}</div>
}
export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 id="dialog-title" className={cn("text-lg font-semibold", className)}>{children}</h2>
}
export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5", className)}>{children}</div>
}
export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex justify-end gap-2 p-5 border-t bg-gray-50 rounded-b-lg", className)}>{children}</div>
}
export function DialogClose({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Close dialog" onClick={onClick} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
      <X className="w-4 h-4" />
    </button>
  )
}
