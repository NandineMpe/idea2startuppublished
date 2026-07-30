import { requireCreatorUser } from "@/lib/creator/auth"
import { loadCorpus } from "@/lib/creator/load-corpus"
import { ImportCorpus } from "@/components/creator/import-corpus"
import { PageBody, PageHeader, StatTile } from "@/components/creator/page-shell"
import { cn } from "@/lib/utils"
import type { TranscriptStatus } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

const TRANSCRIPT_CLASS: Record<TranscriptStatus, string> = {
  done: "text-emerald-600 dark:text-emerald-400",
  running: "text-sky-600 dark:text-sky-400",
  pending: "text-muted-foreground",
  failed: "text-red-600 dark:text-red-400",
  unavailable: "text-amber-600 dark:text-amber-400",
}

/** Plain-language meaning, so a status never reads as a silent failure. */
const TRANSCRIPT_HELP: Record<TranscriptStatus, string> = {
  done: "Spoken content captured — the strongest input for voice.",
  running: "Transcribing now.",
  pending: "Queued for transcription.",
  failed: "Transcription was attempted and errored.",
  unavailable:
    "No audio reachable. A TikTok share link is a web page, not a media file — expected for pasted URLs.",
}

function compact(n: number | null | undefined): string {
  if (typeof n !== "number") return "—"
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

export default async function ContentPage() {
  const { supabase, userId } = await requireCreatorUser()
  const { posts, summary } = await loadCorpus(supabase, userId)
  const withText = posts.filter((p) => (p.caption?.trim() || p.transcript?.trim())).length

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
      <PageHeader title="Content" subtitle="Your corpus. Everything downstream is derived from it." />

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

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Posted
              </th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Caption
              </th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                Transcript
              </th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium text-right">
                Views
              </th>
              <th className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-muted-foreground font-medium text-right">
                Likes
              </th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap tabular-nums">
                  {new Date(post.posted_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-foreground max-w-[420px] truncate">
                  {post.caption || <span className="text-muted-foreground">No caption</span>}
                </td>
                <td
                  className={cn("px-4 py-2.5 text-[12px]", TRANSCRIPT_CLASS[post.transcript_status])}
                  title={TRANSCRIPT_HELP[post.transcript_status]}
                >
                  {post.transcript_status}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-foreground text-right tabular-nums">
                  {compact(post.metrics?.views)}
                </td>
                <td className="px-4 py-2.5 text-[12px] text-foreground text-right tabular-nums">
                  {compact(post.metrics?.likes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
