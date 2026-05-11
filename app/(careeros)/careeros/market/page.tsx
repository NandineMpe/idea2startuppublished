import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getSalaryBandsForUser } from "@/lib/careeros/market/salary-bands"
import { getPersonalSkillVelocityForUser } from "@/lib/careeros/market/skill-velocity"
import { getAdjacentRolesForUser } from "@/lib/careeros/market/adjacent-roles"
import { buildAdjacentRoleTrajectoryPack } from "@/lib/careeros/market/adjacent-trajectory"
import { getDemandTrajectoryForUser } from "@/lib/careeros/market/demand-trajectory"
import { AdjacentRoleTrajectoryCard } from "@/components/careeros/adjacent-role-trajectory-card"

export const dynamic = "force-dynamic"

function fmtMoney(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

export default async function CareerOSMarketPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const salary = await getSalaryBandsForUser(user.id)
  const demand = await getDemandTrajectoryForUser(user.id, { triggerRefreshOnMiss: true })
  const velocity = await getPersonalSkillVelocityForUser(user.id, "M360")
  const adjacent = await getAdjacentRolesForUser(user.id)
  const trajectory = await buildAdjacentRoleTrajectoryPack({
    userId: user.id,
    salary,
    adjacent,
  })

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Market Briefing</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot of where you stand, where the market is going, and where you can move next.
          </p>
        </div>
        <Link href="/careeros" className="text-sm text-primary hover:underline">
          Back to CareerOS
        </Link>
      </div>

      {salary.status === "ready" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              1) Where you stand
            </CardTitle>
            <CardDescription>
              {salary.occupation_title ?? salary.onet_soc_code} in {salary.region_code}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 text-sm">
              <div>
                <span className="text-muted-foreground">Your inferred seniority:</span>{" "}
                <span className="font-medium capitalize">{salary.inferred_seniority_band}</span>
                {typeof salary.years_experience === "number" ? (
                  <span className="text-muted-foreground"> ({salary.years_experience} years experience)</span>
                ) : null}
              </div>
              {salary.current_band ? (
                <div className="mt-1">
                  <span className="text-muted-foreground">
                    {salary.current_salary_usd != null
                      ? "Your current salary:"
                      : "Your current salary band (market proxy):"}
                  </span>{" "}
                  <span className="font-medium">
                    {salary.current_salary_usd != null
                      ? fmtMoney(salary.current_salary_usd, "USD")
                      : `${fmtMoney(salary.current_band.salary_min, salary.current_band.currency_code)} - ${fmtMoney(
                          salary.current_band.salary_max,
                          salary.current_band.currency_code,
                        )}`}
                  </span>
                  {salary.current_vs_market_mid_delta_pct != null ? (
                    <span
                      className={
                        salary.current_vs_market_mid_delta_pct >= 0
                          ? "ml-2 text-emerald-700"
                          : "ml-2 text-amber-700"
                      }
                    >
                      {salary.current_vs_market_mid_delta_pct >= 0 ? "+" : ""}
                      {salary.current_vs_market_mid_delta_pct.toFixed(1)}% vs market-mid baseline
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {salary.bands.map((b) => (
                <div key={b.seniority_band} className="rounded-lg border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {b.seniority_band}
                  </div>
                  <div className="mt-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Min:</span>{" "}
                      <span className="font-medium">{fmtMoney(b.salary_min, b.currency_code)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mid:</span>{" "}
                      <span className="font-medium">
                        {b.salary_mid == null ? "n/a" : fmtMoney(b.salary_mid, b.currency_code)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max:</span>{" "}
                      <span className="font-medium">{fmtMoney(b.salary_max, b.currency_code)}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Samples: {b.sample_size ?? 0}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{b.attribution_summary}</div>
                    <div className="text-xs text-muted-foreground">
                      Updated:{" "}
                      {b.attribution_updated_at
                        ? new Date(b.attribution_updated_at).toISOString().slice(0, 10)
                        : "unavailable"}
                    </div>
                    {b.is_seeded_data ? (
                      <div className="text-xs text-amber-700">Seeded data</div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {salary.overlays.length > 0 ? (
              <div className="rounded-lg border p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  High-value specialisation overlays
                </div>
                <ul className="space-y-1 text-sm">
                  {salary.overlays.map((o) => (
                    <li key={o.specialisation_key} className="flex items-center justify-between">
                      <span>{o.specialisation_label}</span>
                      <span className="font-medium text-emerald-700">
                        +{Math.round((o.delta_pct ?? 0) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : salary.status === "cache_miss" ? (
        <Card>
          <CardHeader>
            <CardTitle>Salary data is loading</CardTitle>
            <CardDescription>
              We queued a refresh for {salary.onet_soc_code} in {salary.region_code}. Please check back soon.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Profile data needed</CardTitle>
            <CardDescription>
              Add your role mapping and region in CareerOS onboarding to unlock market salary bands.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>2) Where the market is going</CardTitle>
          <CardDescription>
            Rolling market demand snapshots for your mapped role and region.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {demand.status === "ready" ? (
            <div className="grid gap-3 md:grid-cols-5">
              {Object.entries(demand.windows).map(([code, row]) =>
                row ? (
                  <div key={code} className="rounded-lg border p-3 text-sm">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">{code}</div>
                    <div className="mt-1 font-medium">
                      {row.demand_index == null ? "n/a" : row.demand_index.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {row.demand_delta_pct == null ? "n/a" : `${row.demand_delta_pct.toFixed(1)}%`}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          ) : demand.status === "cache_miss" ? (
            <p className="text-sm text-muted-foreground">
              Demand cache is warming for {demand.onet_soc_code} in {demand.region_code}. Check back shortly.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete role + region mapping in onboarding to unlock demand trajectory.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) Skills on the move (M360)</CardTitle>
          <CardDescription>
            Personal cut across your current skill space. Values are descriptive posting trends, not forecasts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">Rising</h3>
            {velocity.status === "ready" && velocity.rising.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {velocity.rising.map((r) => (
                  <li key={`up-${r.canonical_skill_key}`} className="flex items-center justify-between">
                    <span>{r.canonical_skill_key}</span>
                    <span className="text-emerald-600">
                      +{Number(r.velocity_score).toFixed(1)}% ({r.prior_window_mention_count ?? 0}→{r.mention_count})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No rising-skill signal yet for your current space.</p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">Declining</h3>
            {velocity.status === "ready" && velocity.declining.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {velocity.declining.map((r) => (
                  <li key={`dn-${r.canonical_skill_key}`} className="flex items-center justify-between">
                    <span>{r.canonical_skill_key}</span>
                    <span className="text-amber-700">
                      {Number(r.velocity_score).toFixed(1)}% ({r.prior_window_mention_count ?? 0}→{r.mention_count})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No declining-skill signal yet for your current space.</p>
            )}
          </div>
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Source attribution and refresh stats are available in the verify route.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4) Where you could go</CardTitle>
          <CardDescription>
            Adjacent role options with expected market deltas and concrete bridge skills.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {adjacent.status === "ready" ? (
            <ul className="space-y-2 text-sm">
              {adjacent.items.slice(0, 5).map((item) => (
                <li key={item.target_soc_code} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.target_title}</div>
                      <div className="text-xs text-muted-foreground">{item.target_soc_code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Fit score</div>
                      <div className="font-medium">{(item.similarity_score * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.salary_mid_delta_pct != null ? (
                      <span className={item.salary_mid_delta_pct >= 0 ? "text-emerald-700" : "text-amber-700"}>
                        Pay delta: {item.salary_mid_delta_pct >= 0 ? "+" : ""}
                        {item.salary_mid_delta_pct.toFixed(1)}%
                        {item.salary_mid_delta_usd != null
                          ? ` (${item.salary_mid_delta_usd >= 0 ? "+" : ""}${fmtMoney(Math.abs(item.salary_mid_delta_usd), "USD")})`
                          : ""}
                      </span>
                    ) : (
                      <span>Pay delta: n/a</span>
                    )}
                    {" · "}
                    {item.demand_delta_pct_points != null ? (
                      <span className={item.demand_delta_pct_points >= 0 ? "text-emerald-700" : "text-amber-700"}>
                        Demand delta: {item.demand_delta_pct_points >= 0 ? "+" : ""}
                        {item.demand_delta_pct_points.toFixed(1)} pts
                      </span>
                    ) : (
                      <span>Demand delta: n/a</span>
                    )}
                  </div>
                  {item.bridge_skills && item.bridge_skills.length > 0 ? (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Bridge skills: {item.bridge_skills.slice(0, 5).join(", ")}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Bridge skills: none required for baseline transition.
                    </div>
                  )}
                  {item.bridge_skill_keys && item.bridge_skill_keys.length > 0 ? (
                    <div className="text-[11px] text-muted-foreground">
                      Action: build {item.bridge_skill_keys.slice(0, 2).join(" + ")} next.
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : adjacent.status === "cache_miss" ? (
            <p className="text-sm text-muted-foreground">
              Adjacent-role cache is warming for {adjacent.source_soc_code}. Check again soon.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete O*NET role mapping in onboarding to unlock adjacent-role paths.
            </p>
          )}
        </CardContent>
      </Card>

      {trajectory.status === "ready" && trajectory.rows.length > 0 ? (
        <AdjacentRoleTrajectoryCard rows={trajectory.rows} />
      ) : null}
    </main>
  )
}
