"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowUpRight, RefreshCw, Telescope } from "lucide-react"
import { horizonLabel } from "@/lib/creator/industry/definitions"
import type { CreatorIndustry } from "@/lib/creator/industry/load"
import type { IndustryEvidence } from "@/lib/creator/industry/build"

const ERA_LABEL: Record<string, string> = {
  before: "Before",
  shift: "What changed",
  now: "Where it is now",
  ahead: "What the registers say is coming",
}

/**
 * One industry, as an arc rather than a feed.
 *
 * The ordering is the argument. Everything above "ahead" is context the reader
 * mostly already has; the section they cannot get anywhere else is the last one,
 * and it is only worth anything because every line under it carries the register
 * it came from and that register's lead time.
 */
export function IndustryDossier({ industry }: { industry: CreatorIndustry }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function build() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/creator/industry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: industry.slug }),
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

  const byEra = (era: string) => industry.arc.filter((p) => p.era === era)
  const ahead = byEra("ahead")

  return (
    <article className="rounded-xl border border-border bg-card p-5 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground">{industry.label}</h2>
          {industry.audience && (
            <p className="text-[11px] text-muted-foreground mt-0.5">For {industry.audience}</p>
          )}
          {industry.headline && (
            <p className="text-[13px] text-foreground/90 mt-2 leading-relaxed max-w-3xl">
              {industry.headline}
            </p>
          )}
        </div>
        <button
          onClick={build}
          disabled={pending}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Reading…" : industry.built_at ? "Rebuild" : "Build"}
        </button>
      </div>

      {error && <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-2">{error}</p>}

      {!industry.built_at && !error && (
        <p className="text-[12px] text-muted-foreground mt-3 leading-relaxed">
          Not built yet. This reads your corpus for {industry.label.toLowerCase()}, sorts it by how far
          ahead each register sits, and turns it into an arc with a dated future.
        </p>
      )}

      {/* What moved since the last build, first. It is the smallest section and
          the only one that is new, which makes it the content queue. */}
      {industry.shifts.length > 0 && (
        <section className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/[0.05] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-400 mb-2">
            Moved since the last read
          </p>
          <ul className="grid gap-2">
            {industry.shifts.map((s, i) => (
              <li key={i} className="text-[12px] text-foreground/90 leading-relaxed">
                {s.claim}
                <EvidenceRow evidence={s.evidence} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {industry.arc.length > 0 && (
        <div className="mt-4 grid gap-4">
          {(["before", "shift", "now"] as const).map((era) => {
            const points = byEra(era)
            if (!points.length) return null
            return (
              <section key={era}>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                  {ERA_LABEL[era]}
                </h3>
                <ul className="grid gap-2.5">
                  {points.map((p, i) => (
                    <li key={i} className="text-[13px] text-foreground/90 leading-relaxed">
                      {p.period && (
                        <span className="text-muted-foreground tabular-nums mr-2">{p.period}</span>
                      )}
                      {p.claim}
                      <EvidenceRow evidence={p.evidence} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {/* The section the whole page exists for, so it gets the emphasis.
              A forecast with no register under it is an opinion, which is why
              every line here carries its lead time. */}
          {ahead.length > 0 && (
            <section className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-4 py-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-2 inline-flex items-center gap-1.5">
                <Telescope className="h-3.5 w-3.5" />
                {ERA_LABEL.ahead}
              </h3>
              <ul className="grid gap-2.5">
                {ahead.map((p, i) => (
                  <li key={i} className="text-[13px] text-foreground leading-relaxed">
                    {p.period && <span className="text-muted-foreground tabular-nums mr-2">{p.period}</span>}
                    {p.claim}
                    <EvidenceRow evidence={p.evidence} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {industry.indicators.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            What each register is telling you
          </h3>
          <div className="rounded-lg border border-border divide-y divide-border">
            {industry.indicators.map((ind, i) => (
              <div key={i} className="px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/80 uppercase tracking-wide">{ind.lane}</span>
                  <span className="ml-2">{horizonLabel(ind.lane)}</span>
                </p>
                <p className="text-[12.5px] text-foreground/90 leading-relaxed mt-1">{ind.reading}</p>
                <EvidenceRow evidence={ind.evidence} />
              </div>
            ))}
          </div>
        </section>
      )}

      {industry.open_questions.length > 0 && (
        <section className="mt-4">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
            What this leaves open
          </h3>
          <ul className="grid gap-1.5">
            {industry.open_questions.map((q, i) => (
              <li key={i} className="text-[12.5px] text-foreground/85 leading-relaxed">
                {q}
              </li>
            ))}
          </ul>
        </section>
      )}

      {industry.built_at && (
        <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border">
          Built {new Date(industry.built_at).toLocaleDateString()} from{" "}
          {industry.built_from.total ?? 0} signals across {industry.built_from.lanes ?? 0} registers:{" "}
          {industry.built_from.ahead ?? 0} leading, {industry.built_from.present ?? 0} present,{" "}
          {industry.built_from.behind ?? 0} lagging.
          {(industry.built_from.ahead ?? 0) < 5 &&
            " Thin on leading registers, so treat the forecast as directional."}
        </p>
      )}
    </article>
  )
}

/** Sources inline under the claim they support, never in a footnote nobody opens. */
function EvidenceRow({ evidence }: { evidence: IndustryEvidence[] }) {
  if (!evidence?.length) return null
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
      {evidence.map((e, i) =>
        e.url ? (
          <a
            key={i}
            href={e.url}
            target="_blank"
            rel="noreferrer"
            title={e.title}
            className="inline-flex items-center gap-0.5 text-[10.5px] text-violet-600 dark:text-violet-400 hover:underline"
          >
            {e.lane}
            {e.published_at ? ` ${e.published_at.slice(0, 7)}` : ""}
            <ArrowUpRight className="h-2.5 w-2.5" />
          </a>
        ) : (
          <span key={i} className="text-[10.5px] text-muted-foreground" title={e.title}>
            {e.lane}
          </span>
        ),
      )}
    </span>
  )
}
