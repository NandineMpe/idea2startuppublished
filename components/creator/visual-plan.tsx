"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Clapperboard, FileText, Repeat, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
// The shared UI contract, not the generator's internal shape: two
// definitions of one object is how they drift.
import type { VisualPlanShape } from "@/lib/creator/types"

/**
 * The shot list for a drafted piece.
 *
 * Document captures are styled apart from everything else on purpose. They are
 * the shots that carry the primary source on screen, they are the reason this
 * plan is worth more than generic visual advice, and they are the ones a
 * creator is most likely to skip because they take a screen recording rather
 * than a prompt.
 */

const ASSET_STYLE: Record<string, { label: string; className: string }> = {
  document_capture: {
    label: "document",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  newspaper_motif: {
    label: "newspaper",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  timeline: { label: "timeline", className: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  data_reveal: { label: "data", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  screen_recording: { label: "screen", className: "bg-teal-500/10 text-teal-700 dark:text-teal-400" },
  talking_head: { label: "to camera", className: "bg-muted text-muted-foreground" },
  b_roll: { label: "b-roll", className: "bg-muted text-muted-foreground" },
  text_card: { label: "text card", className: "bg-muted text-muted-foreground" },
}

export function VisualPlanPanel({ workId, plan }: { workId: string; plan: VisualPlanShape | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/creator/visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ work_id: workId }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  if (!plan) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        <button
          onClick={generate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
        >
          <Clapperboard className="h-3.5 w-3.5" />
          {pending ? "Planning the shots…" : "Plan the visuals"}
        </button>
        {pending && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Building a shot list against the documents this script stands on.
          </p>
        )}
        {error && <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{error}</p>}
      </div>
    )
  }

  const totalSeconds = plan.shots.reduce((sum, s) => sum + (s.seconds ?? 0), 0)

  return (
    <details className="group mt-3 border-t border-border pt-3">
      <summary className="flex items-center gap-1.5 cursor-pointer list-none text-[12px] font-medium text-violet-600 dark:text-violet-400 hover:underline [&::-webkit-details-marker]:hidden">
        <Clapperboard className="h-3.5 w-3.5 shrink-0" />
        Visual plan
        <span className="text-muted-foreground font-normal tabular-nums">
          {plan.shots.length} shots · {totalSeconds}s
        </span>
      </summary>

      <div className="mt-3 grid gap-4">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
            First frame
          </p>
          <p className="text-[14px] font-semibold text-foreground leading-snug">{plan.cover_text}</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
            {plan.cover_concept}
          </p>
        </div>

        <ol className="grid gap-2.5">
          {plan.shots.map((shot, i) => {
            const style = ASSET_STYLE[shot.asset_type] ?? ASSET_STYLE.b_roll
            return (
              <li key={i} className="flex gap-3">
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-8 pt-0.5">
                  {shot.seconds}s
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                        style.className,
                      )}
                    >
                      {style.label}
                    </span>
                    {shot.tool && (
                      <span className="text-[11px] text-muted-foreground">{shot.tool}</span>
                    )}
                  </div>
                  {shot.on_screen_text && (
                    <p className="text-[13px] font-medium text-foreground mt-1 leading-snug">
                      “{shot.on_screen_text}”
                    </p>
                  )}
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                    {shot.visual}
                  </p>
                  {shot.source_url && (
                    <a
                      href={shot.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline break-all inline-flex items-start gap-1 mt-0.5"
                    >
                      <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                      {shot.source_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 70)}
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {plan.captures.length > 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Camera className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                Capture these before you shoot
              </p>
            </div>
            <ul className="grid gap-2">
              {plan.captures.map((c, i) => (
                <li key={i} className="text-[12px] leading-relaxed">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-600 dark:text-violet-400 hover:underline break-all"
                  >
                    {c.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 80)}
                  </a>
                  <p className="text-muted-foreground">{c.highlight}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Series motif</p>
            </div>
            <p className="text-[12px] text-foreground/90 leading-relaxed">{plan.motif}</p>
          </div>
          <div className="rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sound</p>
            </div>
            <p className="text-[12px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {plan.sound}
            </p>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={pending}
          className="justify-self-start text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {pending ? "Re-planning…" : "Plan it again"}
        </button>
        {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </details>
  )
}
