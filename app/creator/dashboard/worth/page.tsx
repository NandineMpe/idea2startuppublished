import { DollarSign } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadWorth } from "@/lib/creator/load-worth"
import { loadCreatorSettings } from "@/lib/creator/load-settings"
import { RateBandCard } from "@/components/creator/rate-band-card"
import { RateLineItems } from "@/components/creator/rate-line-items"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"

export const dynamic = "force-dynamic"

export default async function WorthPage() {
  const { supabase, userId } = await requireCreatorUser()
  const [{ worth, blocker }, { settings }] = await Promise.all([
    loadWorth(supabase, userId),
    loadCreatorSettings(supabase, userId),
  ])

  if (!worth?.headline) {
    return (
      <PageBody>
        <PageHeader title="Worth" subtitle="What you should charge, and why it holds up." />
        <EmptyState
          icon={DollarSign}
          title="No rate yet"
          description="TikTok pays on views, not followers — which is why the rate a brand opens with is usually wrong. This builds a range from your own view distribution so you can point at it."
          blocker={blocker}
        />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader title="Worth" subtitle="What you should charge, and why it holds up." />

      {blocker && <BlockerNotice blocker={blocker} />}

      <div className="mb-7">
        <RateBandCard band={worth.headline} emphasis />
      </div>

      {/* The line items sit directly under the base fee rather than on their own
          screen. A brand deal is a licence, not a post, and the rights the brand
          walks away with are worth more than the shoot — pricing them somewhere
          else is how they end up inside the base fee for free. */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-foreground">Rate card</h2>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-2xl">
            Everything below is a percentage of a base of{" "}
            <span className="font-medium text-foreground tabular-nums">
              {new Intl.NumberFormat("en", {
                style: "currency",
                currency: worth.currency,
                maximumFractionDigits: 0,
              }).format(worth.base_fee)}
            </span>{" "}
            for one video, organic, on your own handle. Raise the base and the whole card reprices.
          </p>
        </div>
        <RateLineItems base={worth.base_fee} currency={worth.currency} overrides={settings.rate_overrides} />
      </section>

      {worth.by_pillar.length > 0 && (
        <section className="mb-7">
          <h2 className="text-[13px] font-semibold text-foreground mb-2.5">By pillar</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {worth.by_pillar.map((band) => (
              <RateBandCard key={`pillar-${band.scope_label}`} band={band} />
            ))}
          </div>
        </section>
      )}

      {worth.by_format.length > 0 && (
        <section className="mb-7">
          <h2 className="text-[13px] font-semibold text-foreground mb-2.5">By format</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {worth.by_format.map((band) => (
              <RateBandCard key={`format-${band.scope_label}`} band={band} />
            ))}
          </div>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground">
        Ranges are built from the 25th and 75th percentile of your actual views, not an average — one
        viral post should not set your floor or your ceiling.
        {worth.metrics_captured_at && ` Metrics captured ${new Date(worth.metrics_captured_at).toLocaleDateString()}.`}
      </p>
    </PageBody>
  )
}
