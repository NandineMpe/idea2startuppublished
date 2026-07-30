"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, Search } from "lucide-react"
import { deriveStoryLineage } from "@/lib/creator/run-agent"
import { cn } from "@/lib/utils"
import type { LineageConfidence, LineageState, StoryLineage } from "@/lib/creator/types"

/**
 * The historical spine of a story: what it is the latest instance of.
 *
 * Confidence is shown per timeline entry rather than hidden, because the cost
 * of an unmarked guess here is a wrong date said on camera.
 */

const CONFIDENCE_STYLE: Record<LineageConfidence, { label: string; className: string }> = {
  documented: {
    label: "sourced",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  well_known: {
    label: "established",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  uncertain: {
    label: "verify before airing",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
}

export function StoryLineagePanel({
  storyId,
  lineage,
  state,
}: {
  storyId: string
  lineage: StoryLineage | null
  state: LineageState
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function derive() {
    startTransition(async () => {
      setError(null)
      const result = await deriveStoryLineage(storyId)
      if (result.ok) {
        setOpen(true)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  if (!lineage) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <button
          onClick={derive}
          disabled={pending || state === "running"}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
        >
          <GitBranch className="h-3.5 w-3.5" />
          {state === "running" || pending ? "Tracing the timeline…" : "What is this building on?"}
        </button>
        {state === "running" && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Searching papers and books for antecedents — takes a minute.
          </p>
        )}
        {state === "failed" && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
            Last attempt failed. Try again.
          </p>
        )}
        {error && <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
      >
        <GitBranch className="h-3.5 w-3.5" />
        {open ? "Hide the timeline" : `The timeline — ${lineage.timeline.length} moments this builds on`}
      </button>

      {open && (
        <div className="mt-4 grid gap-4">
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 grid gap-2">
            <Line label="Building on" value={lineage.building_on} />
            <Line label="The question that keeps returning" value={lineage.recurring_question} />
            <Line label="Genuinely new this time" value={lineage.whats_actually_new} />
            <Line label="Repeating, dressed as new" value={lineage.whats_repeating} />
          </div>

          <ol className="relative border-l border-border ml-1.5 grid gap-4 pl-4">
            {lineage.timeline.map((entry, i) => {
              const conf = CONFIDENCE_STYLE[entry.confidence] ?? CONFIDENCE_STYLE.uncertain
              return (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-violet-500" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-semibold text-foreground tabular-nums">{entry.period}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", conf.className)}>
                      {conf.label}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground mt-1 leading-snug">{entry.event}</p>
                  <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{entry.relevance}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-start gap-1">
                    <Search className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{entry.verify}</span>
                  </p>
                </li>
              )
            })}
          </ol>

          {lineage.research_base.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Research underneath
              </p>
              <div className="grid gap-1.5">
                {lineage.research_base.map((r, i) => (
                  <p key={i} className="text-[12px] text-muted-foreground leading-relaxed">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-600 dark:text-violet-400 hover:underline"
                      >
                        {r.title}
                      </a>
                    ) : (
                      <span className="text-foreground">{r.title}</span>
                    )}
                    {" — "}
                    {r.what_it_shows}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12px] text-muted-foreground leading-relaxed">
      <span className="font-medium text-foreground/80">{label}:</span> {value}
    </p>
  )
}
