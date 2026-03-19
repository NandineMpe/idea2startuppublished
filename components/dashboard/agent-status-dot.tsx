"use client"

import { cn } from "@/lib/utils"
import type { AgentStatus } from "@/types/paperclip"

interface AgentStatusDotProps {
  status: AgentStatus
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

const statusConfig: Record<AgentStatus, { color: string; label: string; pulse: boolean }> = {
  active: { color: "bg-emerald-500", label: "Active", pulse: true },
  paused: { color: "bg-yellow-500", label: "Paused", pulse: false },
  terminated: { color: "bg-red-500", label: "Terminated", pulse: false },
}

const sizeConfig = {
  sm: "w-2 h-2",
  md: "w-2.5 h-2.5",
  lg: "w-3 h-3",
}

export function AgentStatusDot({ status, size = "sm", showLabel = false }: AgentStatusDotProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex">
        {config.pulse && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", config.color)} />
        )}
        <span className={cn("relative inline-flex rounded-full", config.color, sizeConfig[size])} />
      </span>
      {showLabel && (
        <span className="text-xs text-white/60">{config.label}</span>
      )}
    </div>
  )
}
