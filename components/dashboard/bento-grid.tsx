import type React from "react"
import { cn } from "@/lib/utils"

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  cols?: number
}

export function BentoGrid({ children, className, cols = 3, ...props }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        {
          "grid-cols-1 md:grid-cols-2 lg:grid-cols-3": cols === 3,
          "grid-cols-1 md:grid-cols-2": cols === 2,
          "grid-cols-1": cols === 1,
        },
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  title?: string
  icon?: React.ReactNode
  colSpan?: number
  rowSpan?: number
}

export function BentoCard({ children, className, title, icon, colSpan = 1, rowSpan = 1, ...props }: BentoCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/40 bg-card p-6 shadow-sm transition-all hover:shadow-md",
        {
          "md:col-span-2": colSpan === 2,
          "md:row-span-2": rowSpan === 2,
        },
        className,
      )}
      {...props}
    >
      {(title || icon) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="font-semibold text-lg">{title}</h3>}
          {icon && <div className="text-primary">{icon}</div>}
        </div>
      )}
      <div className="flex-1">{children}</div>
    </div>
  )
}
