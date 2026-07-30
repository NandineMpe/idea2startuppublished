import { Clock, Quote } from "lucide-react"
import type { CreatorDraft } from "@/lib/creator/types"

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  return `${seconds}s`
}

/**
 * One drafted piece in the Next Five queue.
 *
 * The hook is surfaced above the body because it is what gets judged first — both by
 * the creator deciding whether to shoot it and by the viewer deciding whether to stay.
 * The rationale is always visible: a draft with no traceable reason to exist is the
 * thing this product is trying not to be.
 */
export function DraftCard({ draft }: { draft: CreatorDraft }) {
  const duration = formatDuration(draft.estimated_duration_seconds)

  return (
    <article className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-foreground leading-snug">{draft.title}</p>
        {duration && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Clock className="h-3 w-3" />
            {duration}
          </span>
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

      {draft.body && (
        <div className="px-4 py-3">
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">{draft.body}</p>
        </div>
      )}

      {draft.rationale && (
        <div className="px-4 py-2.5 border-t border-border">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Why: </span>
            {draft.rationale}
          </p>
        </div>
      )}
    </article>
  )
}
