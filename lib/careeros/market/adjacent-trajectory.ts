import type { AdjacentRolesForUserResult } from "@/lib/careeros/market/adjacent-roles"
import type { UserSalaryBandsResult } from "@/lib/careeros/market/salary-bands"
import { SALARY_SOURCE_DATASET_VERSION, type SalarySeniorityBand } from "@/lib/careeros/market/salary-version"
import { supabaseAdmin } from "@/lib/supabase"
import {
  TRAJECTORY_MODEL_VERSION,
  computeBridgeWeeks,
  excessCompCagrPctVsStay,
  impliedAnnualSalaryGrowthPctFromDemand,
  inferSeniorityBandForTrajectory,
  projectStayPathYear3Usd,
  projectSwitchPathYear3Usd,
} from "@/lib/careeros/market/adjacent-trajectory-model"

export type AdjacentTrajectoryRow = {
  trajectory_model_version: string
  target_soc_code: string
  target_title: string
  rank_position: number
  similarity_score: number
  seniority_band: SalarySeniorityBand
  learning_hours_per_week: number
  source_salary_mid: number | null
  target_salary_mid: number | null
  source_salary_min: number | null
  source_salary_max: number | null
  target_salary_min: number | null
  target_salary_max: number | null
  source_implied_annual_pay_growth_pct: number
  target_implied_annual_pay_growth_pct: number
  bridge_skill_count: number
  bridge_weeks: number
  bridge_months_label: number
  baseline_annual_usd: number
  stay_path_year3_usd: number
  switch_path_year3_usd: number
  excess_comp_cagr_pct_vs_stay: number | null
  methodology_note: string
}

export type AdjacentTrajectoryPack =
  | { status: "unavailable"; reason: string }
  | { status: "ready"; rows: AdjacentTrajectoryRow[] }

function readLearningHoursPerWeek(onboardingState: unknown): number | null {
  if (!onboardingState || typeof onboardingState !== "object") return null
  const st = onboardingState as Record<string, unknown>
  const rawTop = st.learning_hours_per_week
  const rawM11 = typeof st.module_1_1 === "object" && st.module_1_1 !== null ? (st.module_1_1 as Record<string, unknown>).learning_hours_per_week : undefined

  const pick =
    typeof rawTop === "number" && Number.isFinite(rawTop)
      ? rawTop
      : typeof rawM11 === "number" && Number.isFinite(rawM11)
        ? rawM11
        : null

  if (pick == null) return null
  if (pick < 1 || pick > 40) return null
  return pick
}

async function loadLearningHoursPerWeek(userId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .schema("careeros")
    .from("user_settings")
    .select("onboarding_state")
    .eq("user_id", userId)
    .maybeSingle()
  const h = readLearningHoursPerWeek(data?.onboarding_state)
  return h ?? 6
}

async function loadYearsExperience(userId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("years_experience")
    .eq("user_id", userId)
    .maybeSingle()
  const y = data?.years_experience
  return typeof y === "number" && Number.isFinite(y) ? y : null
}

type BandRow = {
  seniority_band: string
  salary_min: number
  salary_mid: number | null
  salary_max: number
}

async function loadBandsForSoc(
  onetSocCode: string,
  regionCode: string,
): Promise<Map<SalarySeniorityBand, BandRow>> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .select("seniority_band,salary_min,salary_mid,salary_max")
    .eq("onet_soc_code", onetSocCode)
    .eq("region_code", regionCode)
    .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)
    .limit(20)
  if (error) throw new Error(error.message)
  const m = new Map<SalarySeniorityBand, BandRow>()
  for (const row of data ?? []) {
    const b = String(row.seniority_band)
    if (b === "junior" || b === "mid" || b === "senior") {
      m.set(b, {
        seniority_band: b,
        salary_min: Number(row.salary_min),
        salary_mid: row.salary_mid == null ? null : Number(row.salary_mid),
        salary_max: Number(row.salary_max),
      })
    }
  }
  return m
}

/**
 * Builds per-target trajectory rows for the Market page. Does not call `getAdjacentRolesForUser`
 * again (avoids duplicate snapshots). Pass the result of a single adjacent read plus salary bands.
 */
export async function buildAdjacentRoleTrajectoryPack(input: {
  userId: string
  salary: UserSalaryBandsResult
  adjacent: AdjacentRolesForUserResult
}): Promise<AdjacentTrajectoryPack> {
  if (input.salary.status !== "ready") {
    return { status: "unavailable", reason: "salary_bands_not_ready" }
  }
  if (input.adjacent.status !== "ready") {
    return { status: "unavailable", reason: "adjacent_roles_not_ready" }
  }

  const [learningHpw, yearsExp] = await Promise.all([
    loadLearningHoursPerWeek(input.userId),
    loadYearsExperience(input.userId),
  ])
  const seniority = inferSeniorityBandForTrajectory(yearsExp)
  const region = input.salary.region_code
  const baseline =
    input.salary.current_salary_usd != null && input.salary.current_salary_usd > 0
      ? input.salary.current_salary_usd
      : input.salary.current_band?.salary_mid != null && input.salary.current_band.salary_mid > 0
        ? input.salary.current_band.salary_mid
        : null

  if (baseline == null || baseline <= 0) {
    return { status: "unavailable", reason: "missing_baseline_comp" }
  }

  const sourceBands = await loadBandsForSoc(input.adjacent.source_soc_code, region)
  const sourceBand = sourceBands.get(seniority) ?? null

  const targets = input.adjacent.items.slice(0, 6)
  const targetSocs = [...new Set(targets.map((t) => t.target_soc_code))]

  const bandsByTarget = new Map<string, Map<SalarySeniorityBand, BandRow>>()
  await Promise.all(
    targetSocs.map(async (soc) => {
      bandsByTarget.set(soc, await loadBandsForSoc(soc, region))
    }),
  )

  const rows: AdjacentTrajectoryRow[] = []

  for (const item of targets) {
    const tb = bandsByTarget.get(item.target_soc_code)?.get(seniority) ?? null
    const targetMid = tb?.salary_mid ?? item.target_salary_mid ?? null
    if (targetMid == null || targetMid <= 0) continue

    const sourceGrowth = impliedAnnualSalaryGrowthPctFromDemand(item.source_demand_delta_pct)
    const targetGrowth = impliedAnnualSalaryGrowthPctFromDemand(item.target_demand_delta_pct)
    const bridgeSkillCount = item.bridge_skill_count ?? item.bridge_skill_keys.length
    const { weeks, monthsRounded } = computeBridgeWeeks({
      bridgeSkillCount,
      learningHoursPerWeek: learningHpw,
    })

    const stayY3 = projectStayPathYear3Usd(baseline, sourceGrowth)
    const switchY3 = projectSwitchPathYear3Usd({
      targetMidAnnualUsd: targetMid,
      bridgeWeeks: weeks,
      targetAnnualGrowthPct: targetGrowth,
    })

    rows.push({
      trajectory_model_version: TRAJECTORY_MODEL_VERSION,
      target_soc_code: item.target_soc_code,
      target_title: item.target_title,
      rank_position: item.rank_position,
      similarity_score: item.similarity_score,
      seniority_band: seniority,
      learning_hours_per_week: learningHpw,
      source_salary_mid: item.source_salary_mid,
      target_salary_mid: targetMid,
      source_salary_min: sourceBand?.salary_min ?? null,
      source_salary_max: sourceBand?.salary_max ?? null,
      target_salary_min: tb?.salary_min ?? null,
      target_salary_max: tb?.salary_max ?? null,
      source_implied_annual_pay_growth_pct: sourceGrowth,
      target_implied_annual_pay_growth_pct: targetGrowth,
      bridge_skill_count: bridgeSkillCount,
      bridge_weeks: weeks,
      bridge_months_label: monthsRounded,
      baseline_annual_usd: Math.round(baseline),
      stay_path_year3_usd: stayY3,
      switch_path_year3_usd: switchY3,
      excess_comp_cagr_pct_vs_stay: excessCompCagrPctVsStay(stayY3, switchY3),
      methodology_note:
        "Growth rates blend a base merit curve with your M360 posting trend for each role. They are not BLS wage forecasts. The 3-year switch path assumes you land near market-mid for the target title at your seniority after the bridge window.",
    })
  }

  if (!rows.length) {
    return { status: "unavailable", reason: "missing_target_salary_mid" }
  }

  return { status: "ready", rows }
}
