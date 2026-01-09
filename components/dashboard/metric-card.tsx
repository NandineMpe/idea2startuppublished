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
        "flex items-center justify-between p-6 rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-md hover:border-primary/20 transition-all duration-300 group shadow-lg",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/40 uppercase tracking-widest font-medium">{title}</span>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
          {change && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              isPositive ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-400")}>
              {change}
            </span>
          )}
        </div>
      </div>
      {icon && <div className="p-3 rounded-xl bg-black/40 text-primary border border-white/5 group-hover:scale-110 transition-transform duration-300 shadow-inner">{icon}</div>}
    </div>
  )
}
