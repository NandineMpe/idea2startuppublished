import { lineItemsByGroup, priceLineItems } from "@/lib/creator/worth/line-items"

function money(n: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * The card below the base fee.
 *
 * Laid out as a quotable list rather than a pricing page, because the moment
 * this is useful is the moment a brand has asked for something and the answer
 * needs a number attached to it inside the hour. Every row carries the published
 * market range it sits inside: a percentage a brand can check is a percentage a
 * brand tends to accept.
 */
export function RateLineItems({
  base,
  currency,
  overrides = {},
}: {
  base: number
  currency: string
  overrides?: Record<string, number>
}) {
  const groups = lineItemsByGroup(priceLineItems(base, overrides))

  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.group}>
          <h3 className="text-[13px] font-semibold text-foreground">{group.label}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5 mb-2.5 leading-relaxed max-w-2xl">
            {group.note}
          </p>

          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground leading-snug">
                    {item.label}
                    {item.overridden && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-violet-600 dark:text-violet-400">
                        yours
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{item.what}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">{item.market}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-semibold text-foreground tabular-nums">
                    {/* Bundles and non-video work are standalone prices; usage,
                        exclusivity and production ride on top of a base fee. The
                        plus sign is the difference between a quote and an
                        add-on, and getting it wrong misreads the whole row. */}
                    {item.multiple === 0
                      ? "Included"
                      : group.group === "bundle" || group.group === "beyond_video"
                        ? money(item.amount, currency)
                        : `+${money(item.amount, currency)}`}
                  </p>
                  {item.multiple > 0 && (
                    <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {Math.round(item.multiple * 100)}% of base
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
