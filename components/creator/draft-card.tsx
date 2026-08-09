import { Clock, Link2, Quote } from "lucide-react"
import { ItemActions } from "@/components/creator/item-actions"
import { Disclosure } from "@/components/creator/disclosure"
import { StoryLineagePanel } from "@/components/creator/story-lineage"
import { VisualPlanPanel } from "@/components/creator/visual-plan"
import { cn } from "@/lib/utils"
import type { CreatorDraft, StoryMove } from "@/lib/creator/types"

const MOVE_STYLE: Record<StoryMove, { label: string; className: string }> = {
  consolidate: { label: "Deepens", className: "bg-muted text-muted-foreground" },
  expand: { label: "Stretches", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  advance: { label: "Advances", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  return `${seconds}s`
}

const SCRIPT_PARTS = [
  { key: "point", label: "Point", note: "the claim, verdict withheld" },
  { key: "trigger", label: "Trigger", note: "why today" },
  { key: "analysis", label: "Analysis", note: "one new fact per beat" },
  { key: "loop", label: "Loop", note: "the verdict, back to the point" },
] as const

/** The last few words, for showing where the loop rejoins the opening. */
function tail(text: string, words = 9): string {
  return text.trim().split(/\s+/).slice(-words).join(" ")
}

function head(text: string, words = 9): string {
  return text.trim().split(/\s+/).slice(0, words).join(" ")
}

/**
 * One drafted piece in the Next Five queue.
 *
 * Ordered the way the decision is actually made, which is not the order it gets
 * shot in. First what the piece argues, then the opener, then everything else
 * folded away. The card used to lead with a working title and a hook, and
 * reading it cold there was no way to tell what it was about without opening
 * the script.
 *
 * The evidence travels with it. A story arrives on the Stories screen with
 * receipts and a lineage, both of which were dropped the moment it became a
 * draft, so the creator was asked to decide whether to shoot something with the
 * reasons for it one screen away and no path back. Those sections are folded
 * rather than absent: they are what you open when you are unsure, and clutter
 * when you are not.
 */
export function DraftCard({ draft }: { draft: CreatorDraft }) {
  const duration = formatDuration(draft.estimated_duration_seconds)
  const source = draft.source
  const move = source ? MOVE_STYLE[source.move] ?? MOVE_STYLE.consolidate : null

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {move && (
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full",
                    move.className,
                  )}
                >
                  {move.label}
                </span>
              )}
              {duration && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                  <Clock className="h-3 w-3" />
                  {duration}
                </span>
              )}
            </div>
            <p className="text-[13px] font-medium text-foreground leading-snug">{draft.title}</p>
          </div>
          <ItemActions
            entity="work"
            id={draft.id}
            noun="draft"
            archiveHint="Archive — takes it out of the queue without deleting the writing"
          />
        </div>

        {/* The narrative, before anything about how it opens. This is what the
            creator reads when deciding whether the piece is worth their day. */}
        {(draft.premise || source?.thesis) && (
          <p className="text-[13px] text-foreground/85 mt-2.5 leading-relaxed">
            {draft.premise || source?.thesis}
          </p>
        )}

        {source?.why_now && (
          <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">
            <span className="font-medium text-foreground/80">Why now:</span> {source.why_now}
          </p>
        )}
      </div>

      {draft.hook && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex gap-2">
            <Quote className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
            <p className="text-[13px] text-foreground leading-relaxed">{draft.hook}</p>
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 grid gap-1">
        {draft.script_sections ? (
          <Disclosure label="The script">
            <div className="grid gap-3">
              {SCRIPT_PARTS.map(({ key, label, note }) => {
                const text = draft.script_sections![key]
                if (!text) return null
                return (
                  <div key={key} className="border-l-2 border-violet-500/30 pl-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {label}
                      <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                        {note}
                      </span>
                    </p>
                    <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
                      {text}
                    </p>
                  </div>
                )
              })}

              {/* The seam is the point of the structure, so it is shown joined
                  rather than left for the creator to imagine. */}
              <div className="rounded-lg border border-dashed border-border px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
                  On replay it reads
                </p>
                <p className="text-[12px] text-foreground/80 leading-relaxed">
                  …{tail(draft.script_sections.loop)}{" "}
                  <span className="text-violet-600 dark:text-violet-400">
                    {head(draft.script_sections.point)}
                  </span>
                  …
                </p>
              </div>

              {/* Off the talk track, and marked as such. The ask sits after the
                  callback as on-screen text rather than in the voice, because a
                  spoken CTA breaks the seam the whole structure is built around. */}
              {draft.script_sections.show && (
                <div className="border-l-2 border-sky-500/40 pl-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Show
                    <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                      what is on screen for each claim, not spoken
                    </span>
                  </p>
                  <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
                    {draft.script_sections.show}
                  </p>
                </div>
              )}

              {draft.script_sections.sell && (
                <div className="border-l-2 border-orange-500/40 pl-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Sell
                    <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                      lands at 60 to 70 per cent, never earlier
                    </span>
                  </p>
                  <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
                    {draft.script_sections.sell}
                  </p>
                </div>
              )}

              {draft.script_sections.ask && (
                <div className="border-l-2 border-emerald-500/40 pl-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Ask
                    <span className="ml-1.5 font-normal normal-case tracking-normal opacity-70">
                      on screen after the last spoken line
                    </span>
                  </p>
                  <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap mt-1">
                    {draft.script_sections.ask}
                  </p>
                </div>
              )}
            </div>
          </Disclosure>
        ) : draft.body ? (
          <Disclosure label="The script">
            <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {draft.body}
            </p>
          </Disclosure>
        ) : null}

        {source?.receipts?.length ? (
          <Disclosure label="Receipts" count={source.receipts.length}>
            <div className="grid gap-2">
              {source.receipts.map((receipt, i) => (
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
        ) : null}

        {/* Stakes rather than a rationale. What is riding on this is what the
            performance depends on, and it is the thing to reread just before
            shooting; an argument for why the story was worth commissioning is
            not. */}
        {(source?.stakes || draft.rationale) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
              Stakes
            </p>
            <p className="text-[12.5px] text-foreground/90 leading-relaxed">
              {source?.stakes || draft.rationale}
            </p>
          </div>
        )}

        {source?.open_question && (
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground/80">Still open:</span> {source.open_question}
          </p>
        )}
      </div>

      {/* The same panel the Stories screen uses, not a copy of it. It renders
          per-entry confidence, and it offers to trace the timeline when the
          story never had one derived — which is most of them, since lineage is
          on demand. A second implementation here would have dropped the
          confidence badges, and an unmarked guess is a wrong date said on
          camera. */}
      <div className="px-4 pb-3">
        <VisualPlanPanel workId={draft.id} plan={draft.visual_plan} />
      </div>

      {source && (
        <div className="px-4 pb-3">
          <StoryLineagePanel
            storyId={source.story_id}
            lineage={source.lineage}
            state={source.lineage_state}
          />
        </div>
      )}
    </article>
  )
}
