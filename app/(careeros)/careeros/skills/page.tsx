import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

type HalfLifeData = {
  status: string | null
  confidence: string | null
  half_life_months: number | null
  half_life_range_low_months: number | null
  half_life_range_high_months: number | null
  calculated_for_date: string | null
  factors_payload: Record<string, unknown> | null
}

type SkillRow = {
  id: string
  skill_name: string
  canonical_skill_key: string
  current_status: string | null
  half_life: HalfLifeData | null
}

type GroupedSkills = {
  rising: SkillRow[]
  stable: SkillRow[]
  declining: SkillRow[]
  "at-risk": SkillRow[]
  uncomputed: SkillRow[]
}

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "rising":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    case "stable":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    case "declining":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    case "at-risk":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function statusLabel(status: string | null): string {
  switch (status) {
    case "rising":
      return "Rising"
    case "stable":
      return "Stable"
    case "declining":
      return "Declining"
    case "at-risk":
      return "At Risk"
    default:
      return "Not computed"
  }
}

function statusIndicator(status: string | null): string {
  switch (status) {
    case "rising":
      return "↑"
    case "stable":
      return "→"
    case "declining":
      return "↓"
    case "at-risk":
      return "↓↓"
    default:
      return "—"
  }
}

function SkillCard({ skill, expanded }: { skill: SkillRow; expanded?: boolean }) {
  const hl = skill.half_life
  const status = hl?.status ?? skill.current_status ?? null
  const hasHalfLife =
    hl?.half_life_months != null || hl?.half_life_range_low_months != null

  const halfLifeDisplay =
    hl?.confidence === "high" && hl.half_life_months != null
      ? `${hl.half_life_months} months`
      : hl?.half_life_range_low_months != null && hl.half_life_range_high_months != null
        ? `${hl.half_life_range_low_months}–${hl.half_life_range_high_months} months`
        : null

  const factors =
    hl?.factors_payload && typeof hl.factors_payload === "object"
      ? (hl.factors_payload as Record<string, unknown>)
      : null

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base font-medium text-foreground truncate">{skill.skill_name}</span>
          <span className="text-sm text-muted-foreground">{statusIndicator(status)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hl?.confidence && (
            <span className="text-xs text-muted-foreground capitalize">{hl.confidence} confidence</span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
          >
            {statusLabel(status)}
          </span>
        </div>
      </div>

      {(status === "declining" || status === "at-risk") && halfLifeDisplay && (
        <p className="text-sm text-muted-foreground">
          Estimated half-life:{" "}
          <span className="font-medium text-foreground">{halfLifeDisplay}</span>
        </p>
      )}

      {factors && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            View analysis details
          </summary>
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            {typeof factors.velocity_score === "number" && (
              <p>
                Market velocity:{" "}
                <span className="font-medium text-foreground">
                  {factors.velocity_score > 0 ? "+" : ""}
                  {factors.velocity_score.toFixed(1)}% posting change
                </span>
              </p>
            )}
            {typeof factors.exposure_score === "number" && (
              <p>
                AI exposure score:{" "}
                <span className="font-medium text-foreground">
                  {(factors.exposure_score as number).toFixed(2)}
                </span>
              </p>
            )}
            {typeof factors.exposure_category === "string" && (
              <p>
                Exposure category:{" "}
                <span className="font-medium text-foreground capitalize">
                  {factors.exposure_category as string}
                </span>
              </p>
            )}
            {Array.isArray(factors.overrides_applied) &&
              (factors.overrides_applied as string[]).length > 0 && (
                <p>
                  Overrides:{" "}
                  <span className="font-medium text-foreground">
                    {(factors.overrides_applied as string[]).join(", ")}
                  </span>
                </p>
              )}
          </div>
        </details>
      )}
    </div>
  )
}

function SectionHeader({
  title,
  count,
  description,
}: {
  title: string
  count: number
  description: string
}) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <span className="text-sm text-muted-foreground">
        {count} skill{count !== 1 ? "s" : ""} — {description}
      </span>
    </div>
  )
}

export default async function SkillsPortfolioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: skillRows, error } = await supabase
    .schema("careeros")
    .from("user_skills")
    .select(
      `id, skill_name, canonical_skill_key, current_status,
       user_skill_half_life:current_half_life_id (
         status, confidence, half_life_months,
         half_life_range_low_months, half_life_range_high_months,
         calculated_for_date, factors_payload
       )`,
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("skill_name", { ascending: true })

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12">
        <p className="text-sm text-destructive">Failed to load skills portfolio. Please try again.</p>
      </main>
    )
  }

  const skills: SkillRow[] = (skillRows ?? []).map((row) => {
    const hlRaw = row.user_skill_half_life
    const hl = hlRaw && typeof hlRaw === "object" && !Array.isArray(hlRaw)
      ? (hlRaw as HalfLifeData)
      : null
    return {
      id: row.id as string,
      skill_name: row.skill_name as string,
      canonical_skill_key: row.canonical_skill_key as string,
      current_status: row.current_status as string | null,
      half_life: hl,
    }
  })

  const grouped: GroupedSkills = {
    rising: [],
    stable: [],
    declining: [],
    "at-risk": [],
    uncomputed: [],
  }

  for (const skill of skills) {
    const status = skill.half_life?.status ?? skill.current_status
    if (status === "rising") grouped.rising.push(skill)
    else if (status === "stable") grouped.stable.push(skill)
    else if (status === "declining") grouped.declining.push(skill)
    else if (status === "at-risk") grouped["at-risk"].push(skill)
    else grouped.uncomputed.push(skill)
  }

  const lastRefreshedDates = skills
    .map((s) => s.half_life?.calculated_for_date)
    .filter((d): d is string => typeof d === "string")
    .sort()
    .reverse()
  const lastRefreshed = lastRefreshedDates[0] ?? null

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          CareerOS / Skills
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Skills Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          How your skills are tracking against AI automation trends and market demand.
          {lastRefreshed && (
            <> Last refreshed {new Date(lastRefreshed).toLocaleDateString()}.</>
          )}
        </p>
      </div>

      {skills.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No skills found</CardTitle>
            <CardDescription>
              Complete your profile to see your skills portfolio analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/careeros/onboarding" className="text-sm text-primary hover:underline">
              Complete your profile
            </Link>
          </CardContent>
        </Card>
      )}

      {skills.length > 0 && grouped.uncomputed.length === skills.length && (
        <Card>
          <CardHeader>
            <CardTitle>Refreshing your portfolio...</CardTitle>
            <CardDescription>
              We are computing half-life analysis for your skills. This usually takes a few minutes
              after your profile is complete or after weekly market data refresh.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {grouped.rising.length > 0 && (
        <section>
          <SectionHeader
            title="Rising"
            count={grouped.rising.length}
            description="Growing demand, low automation risk"
          />
          <div className="space-y-2">
            {grouped.rising.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </section>
      )}

      {grouped.stable.length > 0 && (
        <section>
          <SectionHeader
            title="Stable"
            count={grouped.stable.length}
            description="Steady demand with no significant displacement signal"
          />
          <div className="space-y-2">
            {grouped.stable.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </section>
      )}

      {grouped.declining.length > 0 && (
        <section>
          <SectionHeader
            title="Declining"
            count={grouped.declining.length}
            description="Demand is contracting — consider upskilling"
          />
          <div className="space-y-2">
            {grouped.declining.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </section>
      )}

      {grouped["at-risk"].length > 0 && (
        <section>
          <SectionHeader
            title="At Risk"
            count={grouped["at-risk"].length}
            description="High AI automation exposure or steep demand decline"
          />
          <div className="space-y-2">
            {grouped["at-risk"].map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </section>
      )}

      {grouped.uncomputed.length > 0 && grouped.uncomputed.length < skills.length && (
        <section>
          <SectionHeader
            title="Pending Analysis"
            count={grouped.uncomputed.length}
            description="Half-life not yet computed for these skills"
          />
          <div className="space-y-2">
            {grouped.uncomputed.map((s) => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-border pt-6 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          About this analysis
        </p>
        <p className="text-xs text-muted-foreground max-w-2xl">
          Half-life estimates are computed using Formula v1, which combines job posting velocity data
          (percentage change in posting frequency over 12 months) with AI exposure scores derived from
          Eloundou et al. (2023) &ldquo;GPTs are GPTs: An Early Look at the Labor Market Impact Potential
          of Large Language Models&rdquo; and the McKinsey Skill Change Index (2024). The half-life is
          defined as the time for posting frequency to halve at the current trajectory. This is a
          linear extrapolation, not a prediction. Stable or rising skills have an undefined (null)
          half-life. Augmenting skills grow in value as AI adoption expands and are always classified
          as rising or stable.
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          <Link href="/careeros" className="text-xs text-primary hover:underline">
            Back to CareerOS
          </Link>
        </div>
      </footer>
    </main>
  )
}
