"use client"

import { cn } from "@/lib/utils"
import type { AgentStatus } from "@/types/agent-roles"

interface AgentStatusDotProps {
  status: AgentStatus
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
}

const statusConfig: Record<AgentStatus, { color: string; label: string; pulse: boolean }> = {
  active: { color: "bg-emerald-500", label: "Active", pulse: true },
  paused: { color: "bg-amber-500", label: "Paused", pulse: false },
  terminated: { color: "bg-red-500", label: "Terminated", pulse: false },
}

const sizeConfig = {
  sm: "w-1.5 h-1.5",
  md: "w-2 h-2",
  lg: "w-2.5 h-2.5",
}

export function AgentStatusDot({ status, size = "sm", showLabel = false }: AgentStatusDotProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex">
        {config.pulse && (
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping", config.color)} />
        )}
        <span className={cn("relative inline-flex rounded-full", config.color, sizeConfig[size])} />
      </span>
      {showLabel && (
        <span className="text-[11px] text-muted-foreground font-medium">{config.label}</span>
      )}
    </div>
  )
}
