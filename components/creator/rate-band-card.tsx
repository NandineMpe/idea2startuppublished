import { ConfidenceBadge } from "./confidence-badge"
import type { RateBand } from "@/lib/creator/types"

function compact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n)
}

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * A rate range with the distribution it came from shown underneath.
 *
 * The percentiles are not decoration — they are the argument. A brand's opening offer
 * is usually built from follower count, which on TikTok predicts very little. Being
 * able to point at p25/median/p75 of actual views is what makes the number hold.
 */
export function RateBandCard({ band, emphasis = false }: { band: RateBand; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[12px] uppercase tracking-wide text-muted-foreground">{band.scope_label}</p>
          <p
            className={
              emphasis
                ? "text-[26px] font-semibold text-foreground tabular-nums mt-1"
                : "text-[18px] font-semibold text-foreground tabular-nums mt-1"
            }
          >
            {money(band.rate_low, band.currency)} – {money(band.rate_high, band.currency)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            per sponsored post · quote {money(band.rate_target, band.currency)} as standard
          </p>
          {/* Only shown when the floor actually bit. Saying "floored at your
              proven rate" on a band the distribution already cleared would be
              noise; saying it when the distribution was underpricing her is the
              whole point of storing the number. */}
          {band.floor_applied && band.rate_floor !== null && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
              Floored at {money(band.rate_floor, band.currency)} — what you have actually been paid, which is
              above what this distribution alone would have quoted.
            </p>
          )}
        </div>
        <ConfidenceBadge confidence={band.confidence} sampleSize={band.sample_size} />
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">p25</p>
          <p className="text-[13px] font-medium text-foreground tabular-nums">{compact(band.views_p25)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Median</p>
          <p className="text-[13px] font-medium text-foreground tabular-nums">{compact(band.views_median)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">p75</p>
          <p className="text-[13px] font-medium text-foreground tabular-nums">{compact(band.views_p75)}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">views per post</p>
    </div>
  )
}
