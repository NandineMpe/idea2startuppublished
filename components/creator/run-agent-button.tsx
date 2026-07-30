"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { runCreatorAgent, type AgentKind } from "@/lib/creator/run-agent"
import { cn } from "@/lib/utils"

/**
 * Fires an agent now rather than waiting for its cron. Feedback is deliberately
 * "queued", not "done" — the work runs on Inngest and lands on a screen later.
 */
export function RunAgentButton({
  kind,
  label,
  variant = "secondary",
  withBrief = false,
}: {
  kind: AgentKind
  label: string
  variant?: "primary" | "secondary"
  withBrief?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [brief, setBrief] = useState("")
  const [open, setOpen] = useState(false)

  function run() {
    startTransition(async () => {
      setStatus(null)
      const result = await runCreatorAgent(kind, withBrief ? brief : undefined)
      setStatus(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error })
      if (result.ok) {
        setBrief("")
        setOpen(false)
        // Nothing to show yet, but this clears any stale blocker state.
        router.refresh()
      }
    })
  }

  const buttonClass = cn(
    "inline-flex items-center gap-1.5 h-8 rounded-md px-3 text-[12px] font-medium transition-colors disabled:opacity-50",
    variant === "primary"
      ? "bg-violet-600 text-white hover:bg-violet-700"
      : "border border-border text-foreground hover:bg-accent",
  )

  if (withBrief) {
    return (
      <div className="grid gap-2">
        {open ? (
          <div className="grid gap-2 max-w-[560px]">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="What should this be about? Leave blank to let the Writer choose from your canon."
              className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60"
            />
            <div className="flex items-center gap-2">
              <button onClick={run} disabled={pending} className={buttonClass}>
                {pending ? "Queuing…" : "Write it"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="h-8 rounded-md border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} className={buttonClass}>
            <Play className="h-3.5 w-3.5" />
            {label}
          </button>
        )}
        {status && <StatusLine status={status} />}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button onClick={run} disabled={pending} className={buttonClass}>
        <Play className="h-3.5 w-3.5" />
        {pending ? "Queuing…" : label}
      </button>
      {status && <StatusLine status={status} />}
    </div>
  )
}

function StatusLine({ status }: { status: { ok: boolean; text: string } }) {
  return (
    <p
      className={cn(
        "text-[11px] leading-relaxed max-w-[420px]",
        status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
      )}
    >
      {status.text}
    </p>
  )
}
