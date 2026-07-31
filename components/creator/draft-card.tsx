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
        {draft.body && (
          <Disclosure label="The script">
            <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {draft.body}
            </p>
          </Disclosure>
        )}

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

        {(source?.why_you || draft.rationale) && (
          <Disclosure label="Why you">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              {source?.why_you || draft.rationale}
            </p>
          </Disclosure>
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
