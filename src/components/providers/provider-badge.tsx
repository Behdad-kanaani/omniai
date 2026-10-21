"use client"
import { PROVIDER_DEFINITIONS } from "@/lib/providers/registry"
import { cn } from "@/lib/utils"

export function ProviderBadge({ providerId, size = "sm" }: { providerId: string; size?: "sm" | "md" }) {
  const def = PROVIDER_DEFINITIONS[providerId]
  if (!def) return null
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={cn(
          "rounded-md flex items-center justify-center font-semibold text-white",
          size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
        )}
        style={{ backgroundColor: def.iconColor }}
      >
        {def.iconInitials}
      </div>
      <span className={cn("text-gray-700", size === "sm" ? "text-xs" : "text-sm")}>{def.name}</span>
    </div>
  )
}
