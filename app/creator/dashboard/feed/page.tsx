import { Radio } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadFeedCounts, loadFeedPage } from "@/lib/creator/load-feed"
import { FeedStream } from "@/components/creator/feed-stream"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { EmptyState, PageBody, PageHeader, StatTile } from "@/components/creator/page-shell"

export const dynamic = "force-dynamic"

export default async function FeedPage() {
  const { supabase, userId } = await requireCreatorUser()
  const [page, counts] = await Promise.all([
    loadFeedPage(supabase, userId, { filter: "all" }),
    loadFeedCounts(supabase, userId),
  ])

  return (
    <PageBody>
      <PageHeader
        title="The wire"
        subtitle="Every document your Researcher has pulled, not just the seven it filed. Scroll it, and build a story off anything."
        actions={<RunAgentButton kind="research" label="Sweep now" />}
      />

      {!counts.total ? (
        <EmptyState
          icon={Radio}
          title="Nothing collected yet"
          description="The Researcher sweeps twenty-two sources every morning: dockets, filings, patents, consultations, inspection reports, standards drafts and the rest. Everything it finds lands here."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatTile label="Collected" value={String(counts.total)} hint="documents" />
            <StatTile label="Not yet read" value={String(counts.unseen)} hint="no agent has looked" />
            <StatTile
              label="Passed over"
              value={String(counts.considered)}
              hint="read, not filed"
            />
            <StatTile label="Used" value={String(counts.used)} hint="cited in a story" />
          </div>

          <FeedStream initial={page.signals} initialCursor={page.cursor} />
        </>
      )}
    </PageBody>
  )
}
