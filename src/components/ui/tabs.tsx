"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue { value: string; setValue: (v: string) => void }
const Ctx = React.createContext<TabsContextValue | null>(null)

export function Tabs({ value, defaultValue, onValueChange, children, className }: { value?: string; defaultValue?: string; onValueChange?: (v: string) => void; children: React.ReactNode; className?: string }) {
  const [internal, setInternal] = React.useState(defaultValue || "")
  const v = value ?? internal
  const setV = (nv: string) => { setInternal(nv); onValueChange?.(nv) }
  return <Ctx.Provider value={{ value: v, setValue: setV }}><div className={className}>{children}</div></Ctx.Provider>
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("inline-flex items-center rounded-lg bg-gray-100 p-1 gap-1", className)}>{children}</div>
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const ctx = React.useContext(Ctx)!
  const active = ctx.value === value
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition",
        active ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(Ctx)!
  if (ctx.value !== value) return null
  return <div className={cn("mt-4", className)}>{children}</div>
}
