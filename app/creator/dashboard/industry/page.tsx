import { Factory } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadIndustries } from "@/lib/creator/industry/load"
import { IndustryDossier } from "@/components/creator/industry-dossier"
import { LANE_HORIZONS } from "@/lib/creator/industry/definitions"
import { BlockerNotice, PageBody, PageHeader } from "@/components/creator/page-shell"
import { Disclosure } from "@/components/creator/disclosure"

export const dynamic = "force-dynamic"

export default async function IndustryPage() {
  const { supabase, userId } = await requireCreatorUser()
  const { industries, blocker } = await loadIndustries(supabase, userId)

  const leading = LANE_HORIZONS.filter((h) => h.months[0] >= 3).sort((a, b) => b.months[1] - a.months[1])
  const lagging = LANE_HORIZONS.filter((h) => h.months[1] <= 0)

  return (
    <PageBody>
      <PageHeader
        title="In industry"
        subtitle="What has happened to each industry, where it stands, and what the registers say is coming. Every line carries the register it came from and how far ahead that register sits. Each research sweep collects for four of these in rotation, so the thin ones fill up as you keep running the Researcher."
      />

      {blocker && <BlockerNotice blocker={blocker} />}

      {/* The method, stated once and available on every visit. It is the reason
          the forecasts are worth anything, and a reader who does not know the
          lead times will read the last section as opinion. */}
      <div className="mb-6">
        <Disclosure label="How the future section is dated">
          <div className="text-[12px] text-muted-foreground leading-relaxed grid gap-3">
            <p>
              Registers sit at different distances from visible change. A patent is a claim on something
              that ships in two or three years. A job posting is a team being assembled six months before
              the system it will run. A consultation is a rule roughly two years before it binds. An
              inspection finding is the opposite: it reports what already broke.
            </p>
            <p>
              Sorted by lead time, the same corpus stops being news and becomes a timeline with a future
              end. Nothing in the forecast is dated by opinion. It is dated by the lead time of the
              register underneath it, and every claim links back to the document.
            </p>
            <div className="grid gap-1 pt-1">
              <p className="text-foreground/80 font-medium">Leading</p>
              {leading.map((h) => (
                <p key={h.lane}>
                  <span className="text-foreground/70 uppercase tracking-wide text-[10.5px]">{h.lane}</span>{" "}
                  <span className="tabular-nums">
                    {h.months[0]} to {h.months[1]} months
                  </span>{" "}
                  · {h.reads}
                </p>
              ))}
              <p className="text-foreground/80 font-medium pt-2">Lagging</p>
              {lagging.map((h) => (
                <p key={h.lane}>
                  <span className="text-foreground/70 uppercase tracking-wide text-[10.5px]">{h.lane}</span>{" "}
                  · {h.reads}
                </p>
              ))}
            </div>
          </div>
        </Disclosure>
      </div>

      {industries.map((industry) => (
        <IndustryDossier key={industry.slug} industry={industry} />
      ))}

      {!industries.length && (
        <div className="rounded-xl border border-border bg-card px-4 py-5">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-muted-foreground" />
            <p className="text-[12px] text-muted-foreground">
              No industries defined yet.
            </p>
          </div>
        </div>
      )}
    </PageBody>
  )
}
