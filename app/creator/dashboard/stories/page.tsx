import { Eye, Link2, Newspaper } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadStories } from "@/lib/creator/load-stories"
import { DecideButtons } from "@/components/creator/decide-buttons"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { StoryLineagePanel } from "@/components/creator/story-lineage"
import { Disclosure } from "@/components/creator/disclosure"
import { StoryActions } from "@/components/creator/story-actions"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"
import type { CreatorStory, StorySynthesisKind } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

const KIND_LABELS: Record<StorySynthesisKind, string> = {
  connection: "Connection",
  contradiction: "Contradiction",
  second_order: "Second-order",
  trend_break: "Trend break",
  own_content: "Your content",
}

function StoryCard({ story }: { story: CreatorStory }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400 mb-2">
            {KIND_LABELS[story.synthesis_kind]}
          </span>
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{story.thesis}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {story.work_item_id && <DecideButtons workId={story.work_item_id} />}
          <StoryActions storyId={story.id} />
        </div>
      </div>

      {story.angle && (
        <p className="text-[13px] text-foreground/85 mt-3 leading-relaxed border-l-2 border-violet-500/40 pl-3 italic">
          {story.angle}
        </p>
      )}

      <div className="mt-3 grid gap-1.5">
        {story.why_now && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Why now:</span> {story.why_now}
          </p>
        )}
        {story.why_you && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Why you:</span> {story.why_you}
          </p>
        )}
      </div>

      <StoryLineagePanel storyId={story.id} lineage={story.lineage} state={story.lineage_state} />

      {story.receipts.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <Disclosure label="Receipts" count={story.receipts.length}>
            <div className="grid gap-2">
              {story.receipts.map((receipt, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Link2 className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-[12px] text-muted-foreground leading-relaxed min-w-0">
                    “{receipt.quote}”{" "}
                    {receipt.url && (
                      <a
                        href={receipt.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-violet-600 dark:text-violet-400 hover:underline break-all"
                      >
                        {receipt.title || receipt.url}
                      </a>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </Disclosure>
        </div>
      )}
    </article>
  )
}

export default async function StoriesPage() {
  const { supabase, userId } = await requireCreatorUser()
  const context = await loadStories(supabase, userId)

  return (
    <PageBody>
      <PageHeader
        title="Stories"
        subtitle="Dossiers from your Researcher — connected dots with receipts, never a restated headline."
        actions={<RunAgentButton kind="research" label="Run Researcher" variant="primary" />}
      />

      {context.blocker && <BlockerNotice blocker={context.blocker} />}

      {!context.proposed.length && !context.watchlist.length ? (
        <EmptyState
          icon={Newspaper}
          title="No dossiers yet"
          description="The Researcher sweeps your niche every morning and files a dossier only when at least two independent signals stand a thesis up."
          blocker={context.blocker}
        />
      ) : (
        <>
          <section className="grid gap-4 mb-8">
            {context.proposed.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
            {!context.proposed.length && (
              <p className="text-[12px] text-muted-foreground">Nothing passed the editor gate this run.</p>
            )}
          </section>

          {context.watchlist.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2.5">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[13px] font-semibold text-foreground">Watchlist</h2>
                <span className="text-[11px] text-muted-foreground">
                  single-source theses waiting for corroboration
                </span>
              </div>
              <div className="rounded-xl border border-dashed border-border overflow-hidden">
                {context.watchlist.map((story) => (
                  <div
                    key={story.id}
                    className="px-4 py-3 border-b border-border last:border-b-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground/85 leading-snug">{story.thesis}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {KIND_LABELS[story.synthesis_kind]} · {story.receipts.length} receipt
                        {story.receipts.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StoryActions storyId={story.id} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </PageBody>
  )
}
