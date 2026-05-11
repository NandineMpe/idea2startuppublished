import type { CareerHealthPillarScore } from "./types"

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Map posting demand % change roughly -40..+40 → 0..100 */
function demandDeltaToScore(deltaPct: number | null | undefined): number {
  if (deltaPct == null || Number.isNaN(deltaPct)) return 52
  const x = clamp(deltaPct, -40, 40)
  return Math.round(50 + (x / 40) * 50)
}

/** Map salary vs market mid delta % → 0..100 (at market ~ 72) */
function compDeltaToScore(deltaPct: number | null | undefined): number {
  if (deltaPct == null || Number.isNaN(deltaPct)) return 58
  const x = clamp(deltaPct, -35, 35)
  return Math.round(55 + (x / 35) * 45)
}

export function buildPillarScores(args: {
  skillRows: Array<{
    half_life_status: string | null
    exposure_score: number | null
  }>
  demandDeltaPctM360: number | null
  salaryVsMarketMidDeltaPct: number | null
  layoffSeverity0to1: number | null
}): CareerHealthPillarScore[] {
  const { skillRows, demandDeltaPctM360, salaryVsMarketMidDeltaPct, layoffSeverity0to1 } = args

  const n = skillRows.length
  let risingOrStable = 0
  let decliningOrRisk = 0
  let exposureSum = 0
  let exposureN = 0
  for (const s of skillRows) {
    const st = (s.half_life_status ?? "").toLowerCase()
    if (st === "rising" || st === "stable") risingOrStable += 1
    if (st === "declining" || st === "at-risk") decliningOrRisk += 1
    if (typeof s.exposure_score === "number" && Number.isFinite(s.exposure_score)) {
      exposureSum += s.exposure_score
      exposureN += 1
    }
  }

  const avgExposure = exposureN > 0 ? exposureSum / exposureN : 0.45
  const aiExposureForRole = Math.round(clamp(100 - avgExposure * 100, 15, 95))

  const skillCurrency =
    n === 0
      ? 48
      : Math.round(clamp((risingOrStable / n) * 100 - (decliningOrRisk / n) * 12, 12, 98))

  const marketDemand = demandDeltaToScore(demandDeltaPctM360)

  const compensationPositioning = compDeltaToScore(salaryVsMarketMidDeltaPct)

  let layoffRisk = 68
  if (layoffSeverity0to1 != null && Number.isFinite(layoffSeverity0to1)) {
    layoffRisk = Math.round(clamp(100 - layoffSeverity0to1 * 100, 10, 95))
  }

  const careerVelocity = Math.round(
    (marketDemand + skillCurrency + compensationPositioning) / 3,
  )

  return [
    {
      key: "ai_exposure_for_role",
      score_0_100: aiExposureForRole,
      summary: "Blend of AI displacement exposure across skills tied to your profile.",
      detail: { avg_exposure_score: avgExposure, skills_count: n },
    },
    {
      key: "skill_currency",
      score_0_100: skillCurrency,
      summary: "How many tracked skills look rising or stable versus declining or at risk.",
      detail: { rising_or_stable: risingOrStable, declining_or_at_risk: decliningOrRisk, n },
    },
    {
      key: "market_demand",
      score_0_100: marketDemand,
      summary: "Posting demand trend for your mapped role and region (M360 window when available).",
      detail: { demand_delta_pct_m360: demandDeltaPctM360 },
    },
    {
      key: "compensation_positioning",
      score_0_100: compensationPositioning,
      summary: "Your stated pay versus market mid for your seniority band when we have both.",
      detail: { salary_vs_market_mid_delta_pct: salaryVsMarketMidDeltaPct },
    },
    {
      key: "layoff_risk",
      score_0_100: layoffRisk,
      summary: "Employer-linked layoff signal severity when present. Neutral when missing.",
      detail: { layoff_severity_0_1: layoffSeverity0to1 },
    },
    {
      key: "career_velocity",
      score_0_100: careerVelocity,
      summary: "Blend of demand, skill currency, and pay positioning.",
      detail: {
        parts: ["market_demand", "skill_currency", "compensation_positioning"],
      },
    },
  ]
}

export function compositeFromPillars(pillars: CareerHealthPillarScore[]): number {
  if (!pillars.length) return 50
  const sum = pillars.reduce((a, p) => a + p.score_0_100, 0)
  return Math.round(clamp(sum / pillars.length, 0, 100))
}
