"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Compass } from "lucide-react"
import { DecideButtons } from "@/components/creator/decide-buttons"
import { Disclosure } from "@/components/creator/disclosure"
import { cn } from "@/lib/utils"
import type { CreatorMove } from "@/lib/creator/types"

const EFFORT_STYLE: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
}

/**
 * Strategic moves — what to build, rather than who to invoice.
 *
 * Each carries an outline and a ready-to-send script, because "start a
 * newsletter" is advice and a first email with a subject line is something the
 * creator can do this afternoon.
 */
export function MovesPanel({ moves }: { moves: CreatorMove[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function suggest() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/creator/moves", { method: "POST" })
      const data = (await res.json()) as { proposed?: number; error?: string }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="mb-8">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold text-foreground">Moves</h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">{moves.length}</span>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[620px] leading-relaxed">
            What you should be building that you are not — argued from your own numbers, each with a
            plan and something you can send today.
          </p>
        </div>
        <button
          onClick={suggest}
          disabled={pending}
          className="shrink-0 h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {pending ? "Thinking…" : moves.length ? "Suggest more" : "What should I be doing?"}
        </button>
      </div>

      {error && <p className="text-[12px] text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {!moves.length && !pending && (
        <div className="rounded-xl border border-dashed border-border px-4 py-5">
          <p className="text-[12px] text-muted-foreground">
            Nothing suggested yet. This looks past your next sponsored post — owned audience, paid
            products, advisory, media and licensing — for what your audience makes available.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {moves.map((move) => (
          <MoveCard key={move.id} move={move} />
        ))}
      </div>
    </section>
  )
}

function MoveCard({ move }: { move: CreatorMove }) {
  const [copied, setCopied] = useState(false)
  const o = move.outline

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {o?.category && (
              <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400">
                {o.category}
              </span>
            )}
            {o?.effort && (
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                  EFFORT_STYLE[o.effort] ?? EFFORT_STYLE.medium,
                )}
              >
                {o.effort} effort
              </span>
            )}
          </div>
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{move.title}</h3>
          {move.rationale && (
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{move.rationale}</p>
          )}
        </div>
        <DecideButtons workId={move.id} />
      </div>

      {/* The one line worth reading without opening anything. */}
      {o?.first_step && (
        <p className="text-[12px] text-muted-foreground leading-relaxed mt-3">
          <span className="font-medium text-foreground/80">First step:</span> {o.first_step}
        </p>
      )}

      <div className="mt-3">
        <Disclosure label="The case, the plan and the script">
        <div className="grid gap-4">
          {o && (
            <div className="grid gap-1.5">
              <Line label="Why now" value={o.why_now} />
              <Line label="Realistic upside" value={o.realistic_upside} />
            </div>
          )}
          {o?.steps?.length ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Outline</p>
              <ol className="grid gap-1.5">
                {o.steps.map((step, i) => (
                  <li key={i} className="text-[13px] text-foreground/90 leading-relaxed flex gap-2">
                    <span className="text-violet-500 shrink-0 tabular-nums">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {move.script && (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Script</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(move.script!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="inline-flex items-center gap-1.5 h-7 rounded-md border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="px-4 py-3 text-[13px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {move.script}
              </pre>
            </div>
          )}

          {o?.risks?.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5">
                What would make this a mistake
              </p>
              <ul className="grid gap-1">
                {o.risks.map((r, i) => (
                  <li key={i} className="text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        </Disclosure>
      </div>
    </article>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12px] text-muted-foreground leading-relaxed">
      <span className="font-medium text-foreground/80">{label}:</span> {value}
    </p>
  )
}
