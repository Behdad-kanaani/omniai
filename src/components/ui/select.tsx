"use client"
import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectOption {
  value: string
  label: string
  description?: string
  meta?: string
}

interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function Select({ value, onChange, options, placeholder = "Select...", className, disabled }: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [])

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        <span className={cn("truncate", selected ? "text-gray-900" : "text-gray-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 ml-2 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto py-1">
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">No options</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                "flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-indigo-50",
                o.value === value && "bg-indigo-50"
              )}
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">{o.label}</span>
                {o.description && <span className="text-xs text-gray-500">{o.description}</span>}
              </div>
              {o.meta && <span className="text-xs text-gray-400 shrink-0">{o.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
