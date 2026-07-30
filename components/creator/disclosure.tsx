import type React from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Collapsible section.
 *
 * Built on native details/summary rather than React state so it works inside
 * the server-rendered cards without turning each one into a client component,
 * and so keyboard and screen-reader behaviour comes for free.
 *
 * Closed by default: an opportunity list is for scanning, and a drafted pitch
 * is three hundred words that only matter once you have decided to read one.
 */
export function Disclosure({
  label,
  count,
  children,
  defaultOpen = false,
  className,
}: {
  label: string
  /** Shown beside the label so the section is informative while shut. */
  count?: number | string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  return (
    <details open={defaultOpen} className={cn("group", className)}>
      <summary className="flex items-center gap-1.5 cursor-pointer list-none text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-open:rotate-90" />
        {label}
        {count !== undefined && (
          <span className="text-muted-foreground font-normal tabular-nums">{count}</span>
        )}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  )
}
