import { Sparkles } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadBrand } from "@/lib/creator/brand/load"
import { CATEGORY_LABEL, type ProtocolCategory } from "@/lib/creator/brand/protocols"
import { BrandBasics } from "@/components/creator/brand-basics"
import { BrandDeals } from "@/components/creator/brand-deals"
import { BrandProtocolCard } from "@/components/creator/brand-protocol-card"
import { Disclosure } from "@/components/creator/disclosure"
import { PageBody, PageHeader, StatTile } from "@/components/creator/page-shell"

export const dynamic = "force-dynamic"

export default async function BrandPage() {
  const { supabase, userId } = await requireCreatorUser()
  const brand = await loadBrand(supabase, userId)

  const active = brand.protocols.filter((p) => p.active)
  const menu = brand.protocols.filter((p) => !p.active)

  const tooLate = active.filter((p) => p.state.verdict === "too_late")
  const bookNow = active.filter((p) => p.state.verdict === "book_now")

  const paidByKey: Record<string, number | null> = {}
  for (const p of brand.protocols) paidByKey[p.protocol_key] = p.last_paid

  // The menu grouped, because thirteen untracked treatments in one list is a
  // wall and the categories are how anyone actually thinks about this.
  const byCategory = new Map<ProtocolCategory, typeof menu>()
  for (const p of menu) {
    const list = byCategory.get(p.category) ?? []
    list.push(p)
    byCategory.set(p.category, list)
  }

  return (
    <PageBody>
      <PageHeader
        title="Brand maxing"
        subtitle="Appearance run as a production schedule. Every treatment here has a lead time, and the useful thing is not the list, it is being told which ones are now too late for the next shoot."
      />

      <BrandBasics nextShootAt={brand.next_shoot_at} presentation={brand.presentation} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Next shoot"
          value={brand.next_shoot_at ? new Date(brand.next_shoot_at).toLocaleDateString() : "—"}
          hint={brand.next_shoot_at ? "everything counts back from here" : "not set"}
        />
        <StatTile label="Tracking" value={String(active.length)} hint={`${menu.length} more available`} />
        <StatTile
          label="Book now"
          value={String(bookNow.length)}
          hint={tooLate.length ? `${tooLate.length} too late` : "nothing missed"}
        />
        <StatTile
          label="Yearly"
          value={brand.annual_total ? `${brand.currency} ${brand.annual_total.toLocaleString()}` : "—"}
          hint={brand.annual_unknown ? `${brand.annual_unknown} unpriced` : "from what you paid"}
        />
      </div>

      {active.length > 0 && (
        <section className="mb-7">
          <h2 className="text-[13px] font-semibold text-foreground mb-2.5">Your register</h2>
          <div className="grid gap-3">
            {active.map((p) => (
              <BrandProtocolCard
                key={p.protocol_key}
                protocol={p}
                presentation={brand.presentation}
                currency={brand.currency}
              />
            ))}
          </div>
        </section>
      )}

      {!active.length && (
        <div className="rounded-xl border border-dashed border-border px-5 py-8 mb-7 text-center">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3 mx-auto">
            <Sparkles className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-[14px] font-medium text-foreground">Nothing tracked yet</p>
          <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[460px] mx-auto leading-relaxed">
            Everything below starts switched off on purpose. A register that opens full of treatments
            you have never had is a shopping list, not a record. Turn on the ones you actually do.
          </p>
        </div>
      )}

      <section className="mb-7">
        <h2 className="text-[13px] font-semibold text-foreground mb-2.5">
          {active.length ? "Everything else" : "The catalogue"}
        </h2>
        <div className="grid gap-4">
          {[...byCategory.entries()].map(([category, list]) => (
            <div key={category}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                {CATEGORY_LABEL[category] ?? category}
              </p>
              <div className="grid gap-2">
                {list.map((p) => (
                  <BrandProtocolCard
                    key={p.protocol_key}
                    protocol={p}
                    presentation={brand.presentation}
                    currency={brand.currency}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-6">
        <BrandDeals deals={brand.deals} currency={brand.currency} paidByKey={paidByKey} />
      </div>

      {/* The money question, answered honestly rather than optimistically. Both
          of these are places where a confident wrong answer costs her real
          money or worse, so both say what the actual rule is and stop. */}
      <Disclosure label="Health insurance and tax, what is actually true">
        <div className="text-[12px] text-muted-foreground leading-relaxed grid gap-3 max-w-3xl">
          <div>
            <p className="text-foreground/80 font-medium mb-1">Lymphatic drainage on health insurance</p>
            <p>
              Irish policies generally cover manual lymphatic drainage only where it is medically
              indicated, most commonly after surgery or for lymphoedema, delivered by a chartered
              physiotherapist, and usually paid from an outpatient or therapies allowance rather than
              billed as a treatment in its own right. Cosmetic de-puffing before a shoot is not
              covered by anything, and framing it as though it were is the sort of thing that goes
              badly rather than expensively.
            </p>
            <p className="mt-1.5">
              The realistic route, if you want the sessions covered, is a chartered physiotherapist
              rather than a salon, and a real clinical reason. Check your own policy's therapies
              allowance, since the number of sessions and the per-visit contribution vary a lot
              between plans. That is a question for your insurer, not for this screen.
            </p>
          </div>

          <div>
            <p className="text-foreground/80 font-medium mb-1">Whether any of this is a business expense</p>
            <p>
              Revenue's test is that an expense has to be incurred wholly and exclusively for the
              trade. Grooming and appearance almost always fail it, because they have an obvious
              private benefit at the same time, and that is true even when you genuinely would not
              buy them if you did not film. Do not assume any of the treatments here are deductible.
            </p>
            <p className="mt-1.5">
              The items with a better argument are the ones that only exist for production and have
              no private use, and even those are worth putting to your accountant rather than
              deciding here. What this screen is good for is having the actual numbers ready when you
              ask, which is why it tracks what you paid rather than what things cost.
            </p>
          </div>

          <div>
            <p className="text-foreground/80 font-medium mb-1">The honest ranking</p>
            <p>
              If the budget is finite, the order that does most on camera is roughly: fit and
              tailoring, then hair on a tight cadence, then brows, then skin hydration, then
              everything else. Lighting beats all of it and costs once. Nothing on this screen is
              worth more than a soft key light and a window.
            </p>
          </div>
        </div>
      </Disclosure>
    </PageBody>
  )
}
