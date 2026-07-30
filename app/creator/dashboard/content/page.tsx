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

function compact(n: number | null | undefined): string {
  if (typeof n !== "number") return "—"
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

export default async function ContentPage() {
  const { supabase, userId } = await requireCreatorUser()
  const { posts, summary } = await loadCorpus(supabase, userId)

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
        <StatTile label="Transcribed" value={`${summary.transcribed}/${summary.total_posts}`} />
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
                <td className={cn("px-4 py-2.5 text-[12px]", TRANSCRIPT_CLASS[post.transcript_status])}>
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

      <div className="mt-8">
        <h2 className="text-[13px] font-semibold text-foreground mb-3">Add to the corpus</h2>
        <ImportCorpus />
      </div>
    </PageBody>
  )
}
