/**
 * Deterministic trajectory math for adjacent-role "switch vs stay" views.
 * Salary growth is a heuristic from posting momentum (M360 demand_delta_pct), not a wage index.
 */

export const TRAJECTORY_MODEL_VERSION = "adjacent-trajectory-v1"

/** Order-of-magnitude hours to reach employable level on one bridge skill. */
export const HOURS_PER_BRIDGE_SKILL = 72

export const DEFAULT_LEARNING_HOURS_PER_WEEK = 6

const BASE_MERIT_GROWTH_PCT = 2.5
const DEMAND_TO_PAY_TILT_COEFF = 0.08
const MIN_BRIDGE_WEEKS_NO_GAP = 4
const MAX_BRIDGE_YEARS_FOR_CHART = 2.75

export type SalarySeniorityBand = "junior" | "mid" | "senior"

export function inferSeniorityBandForTrajectory(yearsExperience: number | null): SalarySeniorityBand {
  if (yearsExperience == null || Number.isNaN(yearsExperience)) return "mid"
  if (yearsExperience < 3) return "junior"
  if (yearsExperience < 8) return "mid"
  return "senior"
}

/**
 * Maps M360 posting delta (%) to a small tilt on top of a base merit curve.
 * Label in UI: implied annual pay growth (model), not BLS.
 */
export function impliedAnnualSalaryGrowthPctFromDemand(demandDeltaPct: number | null): number {
  const d = demandDeltaPct ?? 0
  const tilt = Math.max(-3, Math.min(8, DEMAND_TO_PAY_TILT_COEFF * d))
  return Number((BASE_MERIT_GROWTH_PCT + tilt).toFixed(2))
}

export function computeBridgeWeeks(params: {
  bridgeSkillCount: number
  learningHoursPerWeek: number
}): { weeks: number; monthsRounded: number } {
  const hpw = Math.max(1, Math.min(40, params.learningHoursPerWeek))
  const n = Math.max(0, params.bridgeSkillCount)
  const hours = n === 0 ? MIN_BRIDGE_WEEKS_NO_GAP * hpw : n * HOURS_PER_BRIDGE_SKILL
  const weeks = Math.max(MIN_BRIDGE_WEEKS_NO_GAP, Math.ceil(hours / hpw))
  return { weeks, monthsRounded: Math.max(1, Math.round(weeks / 4.33)) }
}

export function bridgeYearsForProjection(weeks: number): number {
  return Math.min(MAX_BRIDGE_YEARS_FOR_CHART, weeks / 52)
}

export function projectStayPathYear3Usd(baselineAnnualUsd: number, annualGrowthPct: number): number {
  if (!Number.isFinite(baselineAnnualUsd) || baselineAnnualUsd <= 0) return 0
  return Math.round(baselineAnnualUsd * (1 + annualGrowthPct / 100) ** 3)
}

/**
 * After the bridge, land at target market-mid (same seniority band), then compound at target growth
 * for the remaining time inside the 3-year window.
 */
export function projectSwitchPathYear3Usd(params: {
  targetMidAnnualUsd: number
  bridgeWeeks: number
  targetAnnualGrowthPct: number
}): number {
  const targetMid = params.targetMidAnnualUsd
  if (!Number.isFinite(targetMid) || targetMid <= 0) return 0
  const g = params.targetAnnualGrowthPct
  const bridgeYears = bridgeYearsForProjection(params.bridgeWeeks)
  const remaining = Math.max(0, 3 - bridgeYears)
  return Math.round(targetMid * (1 + g / 100) ** remaining)
}

/** Excess geometric growth rate of the switch path ending balance vs stay path. */
export function excessCompCagrPctVsStay(stayYear3: number, switchYear3: number): number | null {
  if (!Number.isFinite(stayYear3) || !Number.isFinite(switchYear3) || stayYear3 <= 0 || switchYear3 <= 0) {
    return null
  }
  return Number(((switchYear3 / stayYear3) ** (1 / 3) - 1) * 100)
}
