import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  className?: string
  indicatorClassName?: string
}

export function ProgressBar({ value, className, indicatorClassName }: ProgressBarProps) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <div className={cn("h-full bg-primary", indicatorClassName)} style={{ width: `${value}%` }} />
    </div>
  )
}
