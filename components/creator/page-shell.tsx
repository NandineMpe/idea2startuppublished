import type React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreatorBlocker } from "@/lib/creator/types"

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}) {
  return (
    // Stacked on a phone. Side by side, a two-word title and a "Run
    // Researcher" button fight for 375px and both lose.
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 mb-5 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13px] text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="shrink-0 flex items-center gap-2 flex-wrap">{actions}</div>
      )}
    </div>
  )
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-4 py-5 md:px-6 md:py-6 max-w-[1100px]", className)}>{children}</div>
}

/**
 * Shown wherever a screen has nothing real to render.
 *
 * Deliberately not placeholder data: a shell filled with plausible fake numbers is
 * indistinguishable from a working product, which makes it impossible to tell later
 * what is wired and what is theatre. An empty state names the blocker and the fix.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  blocker,
}: {
  icon: React.ElementType
  title: string
  description: string
  blocker?: CreatorBlocker | null
}) {
  return (
    <div className="border border-dashed border-border rounded-xl px-6 py-12 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
        <Icon className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
      </div>
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[420px]">{description}</p>

      {blocker && (
        <div className="mt-5 w-full max-w-[460px] rounded-lg border border-border bg-muted/40 px-4 py-3 text-left">
          <p className="text-[12px] text-muted-foreground leading-relaxed">{blocker.action}</p>
          {blocker.href && (
            <Link
              href={blocker.href}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline mt-2"
            >
              Go there
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

/** Inline warning for screens that can render but whose data is not yet trustworthy. */
export function BlockerNotice({ blocker }: { blocker: CreatorBlocker }) {
  return (
    <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
      <p className="text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed">{blocker.action}</p>
      {blocker.href && (
        <Link
          href={blocker.href}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-700 dark:text-amber-400 hover:underline mt-1.5"
        >
          Go there
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[20px] font-semibold text-foreground mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  )
}
