"use client"
import * as React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function Avatar({ src, fallback, className }: { src?: string | null; fallback?: string; className?: string }) {
  const [err, setErr] = React.useState(false)
  return (
    <div className={cn("inline-flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white text-xs font-semibold overflow-hidden shrink-0", className)}>
      {src && !err ? (
        <Image src={src} alt="" width={64} height={64} unoptimized className="h-full w-full object-cover" onError={() => setErr(true)} />
      ) : (
        <span>{fallback || "?"}</span>
      )}
    </div>
  )
}
