import type React from "react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  change?: string
  icon?: React.ReactNode
  className?: string
}

export function MetricCard({ title, value, change, icon, className }: MetricCardProps) {
  const isPositive = change && !change.startsWith("-")

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 rounded-lg border border-border/40 bg-background/30 hover:border-primary/30 transition-colors",
        className,
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">{value}</span>
          {change && <span className={cn("text-sm", isPositive ? "text-primary" : "text-red-400")}>{change}</span>}
        </div>
      </div>
      {icon && <div className="text-primary">{icon}</div>}
    </div>
  )
}
