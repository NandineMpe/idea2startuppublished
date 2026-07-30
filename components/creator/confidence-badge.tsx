import { cn } from "@/lib/utils"
import type { Confidence } from "@/lib/creator/types"

/**
 * Confidence is shown next to every derived number, never hidden.
 *
 * A rate or a format trend built on a thin corpus is noise, and the failure mode we
 * care about is a creator quoting a confident wrong figure to a brand. Making the
 * sample strength visible is cheaper than being right.
 */
const STYLES: Record<Confidence, { label: string; className: string }> = {
  insufficient: {
    label: "Not enough data",
    className: "bg-muted text-muted-foreground border-border",
  },
  low: {
    label: "Directional",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
  },
  usable: {
    label: "Usable",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25",
  },
  strong: {
    label: "Strong",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  },
}

export function ConfidenceBadge({
  confidence,
  sampleSize,
  className,
}: {
  confidence: Confidence
  sampleSize?: number
  className?: string
}) {
  const style = STYLES[confidence]

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        style.className,
        className,
      )}
    >
      {style.label}
      {typeof sampleSize === "number" && (
        <span className="opacity-70 tabular-nums">n={sampleSize}</span>
      )}
    </span>
  )
}
