"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, Building2, Map, Milestone, Target } from "lucide-react"
import { Disclosure } from "@/components/creator/disclosure"
import type { CreatorTrajectory } from "@/lib/creator/types"

/**
 * The strategy derived against the declaration.
 *
 * Ordered by how uncomfortable each section is, most uncomfortable first.
 * "Where you actually stand" and "stop doing" are the two the creator cannot
 * get from their own analytics, and burying them under a phase plan would waste
 * the only part of this that is genuinely hard to hear.
 */
export function StrategyPanel({ trajectory }: { trajectory: CreatorTrajectory }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function strategise() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/creator/strategise", { method: "POST" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  const derived = Boolean(trajectory.strategy_derived_at)

  return (
    <section>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-[13px] font-semibold text-foreground">The plan</h2>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[640px] leading-relaxed">
            Worked backwards from where you said you are going, against what you have actually
            published. The search territory it produces is what your Researcher reads on every sweep
            from then on.
          </p>
        </div>
        <button
          onClick={strategise}
          disabled={pending}
          className="shrink-0 h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {pending ? "Working…" : derived ? "Re-run" : "Build the plan"}
        </button>
      </div>

      {error && <p className="text-[12px] text-red-600 dark:text-red-400 mb-3">{error}</p>}

      {!derived ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-5">
          <p className="text-[12px] text-muted-foreground">
            {pending
              ? "Measuring the distance between where you are and where you said you are going."
              : "No plan yet. Build one and every agent on the desk starts working toward it."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {trajectory.position_now && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Where you actually stand
                </h3>
              </div>
              <p className="text-[13px] text-foreground/90 leading-relaxed">{trajectory.position_now}</p>
            </div>
          )}

          {trajectory.stop_doing.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Ban className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  Working, but not building the position
                </h3>
              </div>
              <ul className="grid gap-1.5">
                {trajectory.stop_doing.map((item, i) => (
                  <li key={i} className="text-[13px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {trajectory.gaps.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                What is missing
              </h3>
              <div className="grid gap-3">
                {trajectory.gaps.map((gap, i) => (
                  <div key={i} className="border-l-2 border-violet-500/40 pl-3">
                    <p className="text-[13px] font-medium text-foreground leading-snug">{gap.gap}</p>
                    {gap.why_it_matters && (
                      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                        {gap.why_it_matters}
                      </p>
                    )}
                    {gap.closes_with && (
                      <p className="text-[12px] text-foreground/85 mt-1 leading-relaxed">
                        <span className="font-medium">Closes with:</span> {gap.closes_with}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {trajectory.sequence.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Milestone className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  In what order
                </h3>
              </div>
              <div className="grid gap-4">
                {trajectory.sequence.map((phase, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-foreground">{phase.phase}</span>
                      {phase.months && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">{phase.months}</span>
                      )}
                    </div>
                    {phase.objective && (
                      <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                        {phase.objective}
                      </p>
                    )}
                    {phase.plays.length > 0 && (
                      <ul className="grid gap-1 mt-1.5">
                        {phase.plays.map((play, j) => (
                          <li key={j} className="text-[13px] text-foreground/90 leading-relaxed flex gap-2">
                            <span className="text-violet-500 shrink-0">·</span>
                            <span>{play}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(trajectory.rooms.length > 0 || trajectory.proof_needed.length > 0) && (
            <div className="rounded-xl border border-border bg-card p-5">
              <Disclosure label="Rooms to be in, and the proof that gets you taken seriously">
                <div className="grid gap-4 md:grid-cols-2">
                  {trajectory.rooms.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Where the audience is
                        </p>
                      </div>
                      <ul className="grid gap-1">
                        {trajectory.rooms.map((room, i) => (
                          <li key={i} className="text-[13px] text-foreground/90 leading-relaxed">
                            {room}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {trajectory.proof_needed.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Proof it will take
                      </p>
                      <ul className="grid gap-1">
                        {trajectory.proof_needed.map((proof, i) => (
                          <li key={i} className="text-[13px] text-foreground/90 leading-relaxed">
                            {proof}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Disclosure>
            </div>
          )}

          {trajectory.search_territory.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <Disclosure label="What your Researcher now reads for" count={trajectory.search_territory.length}>
                <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                  These run on every sweep alongside your canon topics, under their own stance, and
                  they lead the list your Researcher synthesises from.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {trajectory.search_territory.map((q, i) => (
                    <span
                      key={i}
                      className="text-[12px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-700 dark:text-violet-400"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              </Disclosure>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
