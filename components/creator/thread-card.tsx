"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Link2, RotateCw } from "lucide-react"
import { Disclosure } from "@/components/creator/disclosure"
import { ItemActions } from "@/components/creator/item-actions"
import { cn } from "@/lib/utils"
import type { CreatorThread, ThreadSignificance } from "@/lib/creator/types"

const SIGNIFICANCE: Record<ThreadSignificance, { label: string; className: string }> = {
  major: {
    label: "Outcome landed",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  notable: { label: "Moved", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  minor: { label: "Procedural", className: "bg-muted text-muted-foreground" },
  none: { label: "Still open", className: "bg-muted text-muted-foreground" },
}

function monthsSince(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 60) return `${days} days ago`
  return `${Math.round(days / 30)} months ago`
}

/**
 * One open file.
 *
 * The anchor date is the headline element rather than a footnote, because the
 * whole value of the card is the gap: you said this in April, here is where it
 * got to. A card that led with today's development would just be news again.
 */
export function ThreadCard({ thread }: { thread: CreatorThread }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const latest = thread.developments.at(-1)
  const badge = SIGNIFICANCE[latest?.significance ?? "none"] ?? SIGNIFICANCE.none

  async function check() {
    setPending(true)
    try {
      await fetch("/api/creator/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check", thread_id: thread.id }),
      })
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                badge.className,
              )}
            >
              {badge.label}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              you covered this {monthsSince(thread.anchor_date)}
            </span>
          </div>
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{thread.subject}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={check}
            disabled={pending}
            title="Check this now"
            aria-label="Check thread now"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 disabled:opacity-40"
          >
            <RotateCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
          </button>
          <ItemActions entity="thread" id={thread.id} noun="thread" archiveHint="Close the file" />
        </div>
      </div>

      {latest?.moved && latest.summary && (
        <p className="text-[13px] text-foreground/90 mt-3 leading-relaxed border-l-2 border-emerald-500/40 pl-3">
          {latest.summary}
        </p>
      )}

      <div className="mt-3 grid gap-1.5">
        <p className="text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground/80">What you said then:</span>{" "}
          {thread.what_was_known}
        </p>
        {!latest?.moved && latest?.summary && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Last check:</span> {latest.summary}
          </p>
        )}
      </div>

      {latest?.receipts?.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <Disclosure label="What has been published since" count={latest.receipts.length}>
            <div className="grid gap-2">
              {latest.receipts.map((receipt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Link2 className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[12px] text-muted-foreground leading-relaxed min-w-0">
                    <span className="tabular-nums">{receipt.published_at.slice(0, 10)}</span>{" "}
                    <span className="text-[10px] uppercase tracking-wide">{receipt.lane}</span>{" "}
                    {receipt.quote && <>“{receipt.quote}” </>}
                    {receipt.url && (
                      <a
                        href={receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-600 dark:text-violet-400 hover:underline break-all"
                      >
                        {receipt.title || receipt.url}
                      </a>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </Disclosure>
        </div>
      ) : null}

      {thread.open_questions.length > 0 && (
        <div className="mt-2">
          <Disclosure label="Still unanswered" count={thread.open_questions.length}>
            <ul className="grid gap-1">
              {thread.open_questions.map((q, i) => (
                <li key={i} className="text-[12px] text-muted-foreground leading-relaxed">
                  {q}
                </li>
              ))}
            </ul>
          </Disclosure>
        </div>
      )}
    </article>
  )
}
