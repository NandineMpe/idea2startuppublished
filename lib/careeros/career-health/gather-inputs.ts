import { createHash } from "crypto"
import { supabaseAdmin } from "@/lib/supabase"
import { getDemandTrajectoryForUser } from "@/lib/careeros/market/demand-trajectory"
import { getSalaryBandsForUser } from "@/lib/careeros/market/salary-bands"
import { buildPillarScores, compositeFromPillars } from "./composite-score"
import type { CareerHealthStructuredInputs } from "./types"

function calendarQuarter(d: Date): { year: number; quarter: number; label: string } {
  const year = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const quarter = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4
  return { year, quarter, label: `Q${quarter} ${year}` }
}

export function careerHealthInputDataVersion(payload: unknown): string {
  const canonical = JSON.stringify(payload)
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16)
}

export async function gatherCareerHealthInputs(userId: string): Promise<CareerHealthStructuredInputs> {
  const now = new Date()
  const { year, quarter, label } = calendarQuarter(now)

  const [{ data: profile, error: pErr }, { data: skills, error: sErr }] = await Promise.all([
    supabaseAdmin
      .schema("careeros")
      .from("user_profiles")
      .select(
        "current_role_title,target_role_title,onet_soc_code,location_region_code,years_experience,current_salary_usd,employer_company_id",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .schema("careeros")
      .from("user_skills")
      .select(
        `skill_name,canonical_skill_key,current_status,
         user_skill_half_life:current_half_life_id ( status )`,
      )
      .eq("user_id", userId)
      .eq("is_active", true),
  ])

  if (pErr) throw pErr
  if (sErr) throw sErr

  const keys = [
    ...new Set(
      (skills ?? [])
        .map((r) => String(r.canonical_skill_key ?? "").trim())
        .filter((k) => k.length > 0),
    ),
  ]

  const exposureByKey: Record<string, { exposure_score: number; exposure_category: string }> = {}
  if (keys.length > 0) {
    const { data: expRows, error: eErr } = await supabaseAdmin
      .schema("careeros")
      .from("skill_ai_exposure_scores")
      .select("canonical_skill_key,exposure_score,exposure_category")
      .in("canonical_skill_key", keys)
    if (eErr) throw eErr
    for (const row of expRows ?? []) {
      const k = String(row.canonical_skill_key ?? "")
      exposureByKey[k] = {
        exposure_score: Number(row.exposure_score ?? 0.5),
        exposure_category: String(row.exposure_category ?? "medium"),
      }
    }
  }

  const skillRows =
    (skills ?? []).map((row) => {
      const hlRaw = row.user_skill_half_life as { status?: string } | unknown[] | null | undefined
      const hl = Array.isArray(hlRaw) ? (hlRaw[0] as { status?: string } | undefined) : hlRaw
      const k = String(row.canonical_skill_key ?? "")
      const exposure = exposureByKey[k]
      return {
        skill_name: String(row.skill_name ?? ""),
        canonical_skill_key: k,
        half_life_status: (hl?.status as string | null) ?? (row.current_status as string | null),
        exposure_score: exposure?.exposure_score ?? null,
        exposure_category: exposure?.exposure_category ?? null,
      }
    }) ?? []

  const [demand, salary] = await Promise.all([
    getDemandTrajectoryForUser(userId, { triggerRefreshOnMiss: false }),
    getSalaryBandsForUser(userId),
  ])

  let demandDeltaPctM360: number | null = null
  if (demand.status === "ready") {
    const m360 = demand.windows?.M360
    demandDeltaPctM360 =
      typeof m360?.demand_delta_pct === "number" ? m360.demand_delta_pct : null
  }

  let salaryVsMarketMidDeltaPct: number | null = null
  if (salary.status === "ready") {
    salaryVsMarketMidDeltaPct =
      typeof salary.current_vs_market_mid_delta_pct === "number"
        ? salary.current_vs_market_mid_delta_pct
        : null
  }

  const employerId = profile?.employer_company_id as string | null | undefined
  let layoffSeverity0to1: number | null = null
  const layoff: Record<string, unknown> = { status: "not_linked" as const }

  if (employerId) {
    const since = new Date(now)
    since.setUTCDate(since.getUTCDate() - 120)
    const { data: sigs, error: lErr } = await supabaseAdmin
      .schema("careeros")
      .from("market_layoff_signals")
      .select("severity_score,signal_date,signal_scope")
      .eq("company_profile_id", employerId)
      .gte("signal_date", since.toISOString().slice(0, 10))
      .order("signal_date", { ascending: false })
      .limit(5)

    if (lErr) throw lErr
    if (sigs?.length) {
      const top = sigs[0]!
      const sev = Number(top.severity_score)
      layoffSeverity0to1 = Number.isFinite(sev) ? clamp01(sev) : null
      layoff.status = "has_company_signals"
      layoff.recent = sigs.map((r) => ({
        signal_date: r.signal_date,
        severity_score: r.severity_score,
        scope: r.signal_scope,
      }))
    } else {
      layoff.status = "no_recent_company_signals"
    }
  } else {
    layoff.status = "phase_4_employer_not_resolved"
    layoff.note =
      "Link your employer in your profile when we ship company intelligence to unlock employer-specific layoff risk."
  }

  const pillars = buildPillarScores({
    skillRows: skillRows.map((s) => ({
      half_life_status: s.half_life_status,
      exposure_score: s.exposure_score,
    })),
    demandDeltaPctM360,
    salaryVsMarketMidDeltaPct,
    layoffSeverity0to1,
  })

  const composite = compositeFromPillars(pillars)

  return {
    generated_at_iso: now.toISOString(),
    period_label: label,
    report_year: year,
    report_quarter: quarter,
    profile: {
      current_role_title: (profile?.current_role_title as string | null) ?? null,
      target_role_title: (profile?.target_role_title as string | null) ?? null,
      onet_soc_code: (profile?.onet_soc_code as string | null) ?? null,
      region_code: (profile?.location_region_code as string | null) ?? null,
      years_experience:
        profile?.years_experience != null ? Number(profile.years_experience) : null,
      current_salary_usd:
        profile?.current_salary_usd != null ? Number(profile.current_salary_usd) : null,
    },
    skills: skillRows,
    demand: demand as unknown as Record<string, unknown>,
    salary: salary as unknown as Record<string, unknown>,
    layoff,
    pillar_scores: pillars,
    composite_score_0_100: composite,
  }
}

function clamp01(x: number): number {
  if (x > 1 && x <= 100) return Math.min(1, x / 100)
  return Math.max(0, Math.min(1, x))
}
