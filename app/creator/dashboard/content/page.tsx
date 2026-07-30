import { requireCreatorUser } from "@/lib/creator/auth"
import { loadCorpus, summarisePerformance } from "@/lib/creator/load-corpus"
import { CorpusTable } from "@/components/creator/corpus-table"
import { ImportCorpus } from "@/components/creator/import-corpus"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { PageBody, PageHeader, StatTile } from "@/components/creator/page-shell"
import { formatEngagementRate } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

function compact(n: number | null | undefined): string {
  if (typeof n !== "number") return "—"
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

export default async function ContentPage() {
  const { supabase, userId } = await requireCreatorUser()
  const { posts, summary } = await loadCorpus(supabase, userId)
  const withText = posts.filter((p) => p.caption?.trim() || p.transcript?.trim()).length
  const perf = summarisePerformance(posts)

  if (!posts.length) {
    return (
      <PageBody>
        <PageHeader title="Content" subtitle="Your corpus. Everything downstream is derived from it." />
        <ImportCorpus />
      </PageBody>
    )
  }

  return (
    <PageBody className="max-w-[1300px]">
      <PageHeader
        title="Content"
        subtitle="Your corpus. Everything downstream is derived from it."
        actions={<RunAgentButton kind="metrics" label="Refresh metrics" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatTile
          label="Total views"
          value={compact(perf.total_views)}
          hint={`across ${perf.measured} measured post${perf.measured === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Median views"
          value={compact(perf.median_views)}
          hint={
            perf.views_p25 !== null && perf.views_p75 !== null
              ? `${compact(perf.views_p25)}–${compact(perf.views_p75)} typical range`
              : undefined
          }
        />
        <StatTile
          label="Median engagement"
          value={formatEngagementRate(perf.median_engagement)}
          hint={
            perf.best_engagement !== null
              ? `best post ${formatEngagementRate(perf.best_engagement)}`
              : undefined
          }
        />
        <StatTile
          label="Saves"
          value={compact(perf.total_saves)}
          hint={`${compact(perf.total_likes)} likes · ${compact(perf.total_comments)} comments`}
        />
      </div>

      <p className="text-[11px] text-muted-foreground mb-6">
        Medians, not averages — view counts are power-law, so one viral post pulls a mean somewhere
        no future post will land. Engagement is (likes + comments + shares + saves) ÷ views.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile label="Posts" value={String(summary.total_posts)} />
        <StatTile
          label="With text"
          value={`${withText}/${summary.total_posts}`}
          hint="caption or transcript"
        />
        <StatTile label="With metrics" value={`${summary.with_metrics}/${summary.total_posts}`} />
        <StatTile
          label="Range"
          value={
            summary.earliest_post_at && summary.latest_post_at
              ? `${new Date(summary.earliest_post_at).getFullYear()}–${new Date(summary.latest_post_at).getFullYear()}`
              : "—"
          }
        />
      </div>

      <CorpusTable posts={posts} />

      {summary.with_metrics === 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 max-w-[640px]">
          <p className="text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed">
            <span className="font-medium">Pasted URLs carry no metrics or true post dates.</span> Captions
            are recovered automatically, but view counts drive Worth and the real posted date drives format
            trends — both come only from the TikTok data export below. Until then treat dates as
            import-time, not publish-time.
          </p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Add to the corpus</h2>
        <ImportCorpus />
      </div>
    </PageBody>
  )
}
