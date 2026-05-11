"use client"

import type { AdjacentTrajectoryRow } from "@/lib/careeros/market/adjacent-trajectory"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

function shortTitle(title: string, max = 28) {
  if (title.length <= max) return title
  return `${title.slice(0, max - 1)}…`
}

export function AdjacentRoleTrajectoryCard(props: { rows: AdjacentTrajectoryRow[] }) {
  const { rows } = props
  if (!rows.length) return null

  const defaultTab = rows[0]!.target_soc_code

  return (
    <Card>
      <CardHeader>
        <CardTitle>5) Role trajectories (3-year model)</CardTitle>
        <CardDescription>
          Each tab compares staying in your current title versus switching to one adjacent role. Bridge time
          uses your bridge skill count, hours per skill, and learning hours per week (from CareerOS settings when
          set). Pay growth blends a base merit curve with M360 posting momentum for each role, not a government
          wage index. After salary or demand cache refreshes, reload this page to pull the latest cached numbers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
            {rows.map((r) => (
              <TabsTrigger key={r.target_soc_code} value={r.target_soc_code} className="max-w-[200px] shrink text-left">
                <span className="truncate">{shortTitle(r.target_title, 26)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {rows.map((r) => (
            <TabsContent key={r.target_soc_code} value={r.target_soc_code} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Stay path (3y)
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{fmtMoney(r.stay_path_year3_usd)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Baseline {fmtMoney(r.baseline_annual_usd)} compounded at {r.source_implied_annual_pay_growth_pct}
                    % / yr (model).
                  </p>
                </div>
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Bridge investment
                  </div>
                  <p className="mt-2 text-lg font-semibold">
                    ~{r.bridge_months_label} mo · {r.bridge_weeks} wk
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.bridge_skill_count} bridge skill{r.bridge_skill_count === 1 ? "" : "s"} at{" "}
                    {r.learning_hours_per_week} h/wk learn pace · {r.seniority_band} band
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Switch path (3y)
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{fmtMoney(r.switch_path_year3_usd)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Land near target mid {fmtMoney(r.target_salary_mid)} after bridge, then{" "}
                    {r.target_implied_annual_pay_growth_pct}% / yr (model).
                  </p>
                </div>
              </div>

              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Your role (mid proxy)</div>
                  <div className="mt-1 font-medium tabular-nums">
                    {r.source_salary_mid != null ? fmtMoney(r.source_salary_mid) : "n/a"}
                  </div>
                  {r.source_salary_min != null && r.source_salary_max != null ? (
                    <div className="text-xs text-muted-foreground">
                      Band {fmtMoney(r.source_salary_min)} – {fmtMoney(r.source_salary_max)}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Implied annual pay growth (12m window model): {r.source_implied_annual_pay_growth_pct}%
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Target role (same band)</div>
                  <div className="mt-1 font-medium tabular-nums">
                    {r.target_salary_mid != null ? fmtMoney(r.target_salary_mid) : "n/a"}
                  </div>
                  {r.target_salary_min != null && r.target_salary_max != null ? (
                    <div className="text-xs text-muted-foreground">
                      Band {fmtMoney(r.target_salary_min)} – {fmtMoney(r.target_salary_max)}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Implied annual pay growth (12m window model): {r.target_implied_annual_pay_growth_pct}%
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-dashed p-3 text-sm">
                <span className="font-medium">Implied excess CAGR vs stay path (3y horizon): </span>
                {r.excess_comp_cagr_pct_vs_stay == null ? (
                  <span className="text-muted-foreground">n/a</span>
                ) : (
                  <span className={r.excess_comp_cagr_pct_vs_stay >= 0 ? "text-emerald-700" : "text-amber-800"}>
                    {r.excess_comp_cagr_pct_vs_stay >= 0 ? "+" : ""}
                    {r.excess_comp_cagr_pct_vs_stay.toFixed(2)} pts
                  </span>
                )}
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">{r.methodology_note}</p>
              <p className="text-[11px] text-muted-foreground">Model {r.trajectory_model_version}</p>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
