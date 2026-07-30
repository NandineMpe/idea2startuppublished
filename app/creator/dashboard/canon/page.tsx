import type React from "react"
import { Fingerprint, TrendingDown, TrendingUp, Minus, HelpCircle } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadCanon, isCanonStale } from "@/lib/creator/load-canon"
import { ConfidenceBadge } from "@/components/creator/confidence-badge"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"
import type { FormatTrend } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

const TREND_ICON: Record<FormatTrend, React.ElementType> = {
  rising: TrendingUp,
  flat: Minus,
  decaying: TrendingDown,
  unknown: HelpCircle,
}

const TREND_CLASS: Record<FormatTrend, string> = {
  rising: "text-emerald-600 dark:text-emerald-400",
  flat: "text-muted-foreground",
  decaying: "text-amber-600 dark:text-amber-400",
  unknown: "text-muted-foreground",
}

function compact(n: number | null): string {
  if (n === null) return "—"
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

function VoiceList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((entry) => (
          <li key={entry} className="text-[13px] text-foreground leading-relaxed">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default async function CanonPage() {
  const { supabase, userId } = await requireCreatorUser()
  const { canon, corpus, blocker } = await loadCanon(supabase, userId)

  if (!canon) {
    return (
      <PageBody>
        <PageHeader title="Canon" subtitle="Who you are, derived from what you actually made." />
        <EmptyState
          icon={Fingerprint}
          title="Not derived yet"
          description="Your canon is extracted from the corpus, never typed in by hand. Pillars, formats, voice and topics all come out of posts you have already published."
          blocker={blocker}
        />
      </PageBody>
    )
  }

  const stale = isCanonStale(canon, corpus.total_posts)

  return (
    <PageBody>
      <PageHeader
        title="Canon"
        subtitle="Who you are, derived from what you actually made."
        actions={<ConfidenceBadge confidence={canon.confidence} sampleSize={canon.corpus_size} />}
      />

      {blocker && <BlockerNotice blocker={blocker} />}

      {stale && (
        <div className="mb-5 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <p className="text-[12px] text-muted-foreground">
            Derived from {canon.corpus_size} posts; the corpus now holds {corpus.total_posts}. Re-derive to
            pick up what has changed since.
          </p>
        </div>
      )}

      <section className="mb-7">
        <h2 className="text-[13px] font-semibold text-foreground mb-2.5">Pillars</h2>
        {canon.pillars.length ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {canon.pillars.map((pillar) => (
              <div
                key={pillar.id}
                className="px-4 py-3 border-b border-border last:border-b-0 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{pillar.label}</p>
                  {pillar.description && (
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                      {pillar.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-medium text-foreground tabular-nums">
                    {compact(pillar.median_views)}
                  </p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {pillar.post_count} posts · {Math.round(pillar.share_of_output * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No pillars derived.</p>
        )}
      </section>

      <section className="mb-7">
        <h2 className="text-[13px] font-semibold text-foreground mb-2.5">Formats</h2>
        {canon.formats.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {canon.formats.map((format) => {
              const Icon = TREND_ICON[format.trend]
              return (
                <div key={format.id} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13px] font-medium text-foreground">{format.label}</p>
                    <span className={`inline-flex items-center gap-1 text-[11px] ${TREND_CLASS[format.trend]}`}>
                      <Icon className="h-3 w-3" />
                      {format.trend}
                    </span>
                  </div>
                  {format.structure.length > 0 && (
                    <p className="text-[12px] text-muted-foreground mt-1.5">{format.structure.join(" → ")}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                    {format.post_count} posts · {compact(format.median_views)} median views
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No formats derived.</p>
        )}
      </section>

      <section className="mb-7">
        <h2 className="text-[13px] font-semibold text-foreground mb-2.5">Voice</h2>
        {canon.voice ? (
          <div className="rounded-xl border border-border bg-card px-5 py-4 grid gap-5 md:grid-cols-2">
            <VoiceList label="Openers" items={canon.voice.openers} />
            <VoiceList label="Rhythm" items={canon.voice.rhythm_notes} />
            <VoiceList label="Vocabulary" items={canon.voice.vocabulary} />
            <VoiceList label="Never says" items={canon.voice.never_says} />
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No voice profile derived.</p>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-semibold text-foreground mb-2.5">Topics</h2>
        {canon.topics.length ? (
          <div className="flex flex-wrap gap-2">
            {canon.topics.map((topic) => (
              <span
                key={topic.label}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] text-foreground"
              >
                {topic.label}
                <span className="text-muted-foreground tabular-nums">{Math.round(topic.weight * 100)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">No topic graph derived.</p>
        )}
      </section>
    </PageBody>
  )
}
