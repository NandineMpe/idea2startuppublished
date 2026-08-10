import { Eye, FileText, Link2, Newspaper } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadStories } from "@/lib/creator/load-stories"
import { DecideButtons } from "@/components/creator/decide-buttons"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { StoryLineagePanel } from "@/components/creator/story-lineage"
import { Disclosure } from "@/components/creator/disclosure"
import { StoryActions } from "@/components/creator/story-actions"
import { SeedStoryPanel } from "@/components/creator/seed-story"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"
import type { CreatorStory, StoryMove, StorySynthesisKind } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

const KIND_LABELS: Record<StorySynthesisKind, string> = {
  connection: "Connection",
  contradiction: "Contradiction",
  second_order: "Second-order",
  trend_break: "Trend break",
  own_content: "Your content",
}

const MOVE_LABELS: Record<StoryMove, { label: string; hint: string; className: string }> = {
  consolidate: {
    label: "Deepens",
    hint: "Ground you already own. Safe, and it does not move your position.",
    className: "bg-muted text-muted-foreground",
  },
  expand: {
    label: "Stretches",
    hint: "Adjacent to what you have worked, still connected to your authority.",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  },
  advance: {
    label: "Advances",
    hint: "Builds the position you said you are moving toward.",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
}

function StoryCard({ story }: { story: CreatorStory }) {
  const move = MOVE_LABELS[story.move] ?? MOVE_LABELS.consolidate

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className="inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400">
              {KIND_LABELS[story.synthesis_kind]}
            </span>
            {/* Whether a story moves the creator or just deepens the archive is
                the thing they most need to see at a glance. */}
            <span
              title={move.hint}
              className={`inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full ${move.className}`}
            >
              {move.label}
            </span>
            {/* Format before emotion: a story tagged 'written' will never be
                drafted as a script, and finding that out at the shoot is the
                error this badge exists to prevent. */}
            {story.output_format !== "script" && (
              <span
                title={
                  story.output_format === "written"
                    ? "This is a byline, not a video. Approving it will not commission a script."
                    : "This is a thing to build, not a thing to say. Approving it will not commission a script."
                }
                className="inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400"
              >
                {story.output_format === "written" ? "Write it" : "Build it"}
              </span>
            )}
            {story.primary_emotion && story.primary_emotion !== "knowledge" && (
              <span
                title="The primary emotion this piece is built to land. Knowledge is the home lane; anything else is seasoning."
                className="inline-block text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {story.primary_emotion}
              </span>
            )}
          </div>
          {/* The hook leads. It is the one line that can be judged in a second,
              and the thesis is what gets read once the hook has earned it. */}
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">
            {story.hook_line || story.thesis}
          </h3>
          {story.hook_line && (
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{story.thesis}</p>
          )}
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

      {/* Stakes sit above why-now and in their own box. It is the boredom gate,
          the thing the writer builds the emotion from, and the field most
          likely to be skimmed past if it is set as another grey line. */}
      {story.stakes && (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
            Stakes
          </p>
          <p className="text-[12.5px] text-foreground/90 leading-relaxed">{story.stakes}</p>
        </div>
      )}

      <div className="mt-3 grid gap-1.5">
        {story.why_now && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Why now:</span> {story.why_now}
          </p>
        )}
        {story.named_actor && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Who acted:</span> {story.named_actor}
          </p>
        )}
        {story.open_question && (
          <p className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Still open:</span> {story.open_question}
          </p>
        )}
      </div>

      {/* What replaced why-you. Both are things a good editor says out loud, and
          neither is an argument for the story, which is the point: the desk had
          been justifying its own output rather than handing over its doubts. */}
      {(story.unknowns || story.kill_reason) && (
        <div className="mt-3">
          <Disclosure label="What the desk does not know, and the case against">
            <div className="grid gap-2">
              {story.unknowns && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Not known yet:</span> {story.unknowns}
                </p>
              )}
              {story.kill_reason && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground/80">Strongest reason to kill:</span>{" "}
                  {story.kill_reason}
                </p>
              )}
            </div>
          </Disclosure>
        </div>
      )}

      {/* What the desk read, rather than what it found. The silences are given
          their own treatment because they are the part that cannot be got from
          a summary and, in practice, where most of the angles come from. */}
      {story.extracts && story.extracts.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <Disclosure
            label="Read in full"
            count={story.extracts.length}
          >
            <div className="grid gap-4">
              {story.extracts.map((extract) => (
                <div key={extract.signal_id}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <a
                      href={extract.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline break-all"
                    >
                      {extract.source_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                    </a>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {Math.round(extract.content_chars / 1000)}k chars
                    </span>
                  </div>

                  <div className="grid gap-2">
                    {extract.key_claims.map((claim, i) => (
                      <div key={i} className="border-l-2 border-emerald-500/40 pl-3">
                        <p className="text-[12.5px] text-foreground/90 leading-relaxed">
                          “{claim.quote}”
                          {claim.locator && (
                            <span className="text-muted-foreground text-[11px]"> — {claim.locator}</span>
                          )}
                        </p>
                        {claim.why_it_matters && (
                          <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                            {claim.why_it_matters}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {extract.silences.length > 0 && (
                    <div className="mt-2 rounded-lg bg-muted/40 border border-border px-3 py-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                        What it does not say
                      </p>
                      <ul className="grid gap-1">
                        {extract.silences.map((silence, i) => (
                          <li key={i} className="text-[12px] text-foreground/85 leading-relaxed">
                            {silence}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Disclosure>
        </div>
      )}

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

      {/* Above the swept dossiers: a lead the creator brought is the one they
          are already thinking about, and it should not be behind a scroll. */}
      <SeedStoryPanel />

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
