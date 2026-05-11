// Pure function — no DB access, fully unit-testable
// Formula v1

export type ExposureCategory = "low" | "medium" | "high" | "augmenting"
export type HalfLifeStatus = "rising" | "stable" | "declining" | "at-risk"
export type HalfLifeConfidence = "high" | "medium" | "low"

export interface HalfLifeInput {
  canonical_skill_key: string
  velocity_score: number // % change in postings (from market_skill_velocity)
  mention_count: number // sample size
  prior_window_mention_count: number | null
  exposure_score: number // 0.0-1.0, defaults to 0.5 if missing
  exposure_category: ExposureCategory // defaults to 'medium' if missing
}

export interface HalfLifeResult {
  status: HalfLifeStatus
  half_life_months: number | null // null when status is 'rising' or 'stable'
  half_life_range: { low: number; high: number } | null // for medium/low confidence
  confidence: HalfLifeConfidence
  effective_annual_decline_rate: number // D value
  factors_payload: {
    velocity_score: number
    mention_count: number
    exposure_score: number
    exposure_category: ExposureCategory
    window_volatility: number | null
    formula_version: string
    overrides_applied: string[]
  }
}

export const HALF_LIFE_METHODOLOGY_VERSION = "v1"

export function computeHalfLife(input: HalfLifeInput): HalfLifeResult {
  const {
    velocity_score: v,
    mention_count,
    prior_window_mention_count,
    exposure_category: c,
  } = input
  const e = input.exposure_score

  // Compute effective annual decline rate D
  let D: number
  const overrides: string[] = []

  if (c === "augmenting") {
    D = -0.10 - Math.max(0, (-v / 100) * 0.5)
  } else if (v >= 0 && e <= 0.3) {
    D = -v / 100
  } else if (v >= 0 && e > 0.3) {
    D = -v / 100 + (e - 0.3) * 0.15
  } else {
    // v < 0 (declining)
    D = -v / 100 + e * 0.10
  }

  // Determine base status
  let status: HalfLifeStatus
  if (D < -0.05) {
    status = "rising"
  } else if (D <= 0.05) {
    status = "stable"
  } else if (D <= 0.15) {
    status = "declining"
  } else {
    status = "at-risk"
  }

  // Overrides
  if (c === "augmenting" && v < 0) {
    status = "at-risk"
    overrides.push("augmenting_skill_declining_demand")
  }
  if (e > 0.7 && v >= 0) {
    status = "at-risk"
    overrides.push("high_ai_exposure_despite_growth")
  }

  // Compute half-life (only meaningful when D > 0, i.e. skill is declining)
  let half_life_months: number | null = null
  if (D > 0) {
    half_life_months = (Math.log(2) / Math.log(1 + D)) * 12
  }

  // Compute window_volatility from prior/current mention counts
  let window_volatility: number | null = null
  if (prior_window_mention_count !== null && prior_window_mention_count > 0) {
    window_volatility =
      Math.abs(mention_count - prior_window_mention_count) / prior_window_mention_count
  }

  // Compute confidence
  let confidence: HalfLifeConfidence
  if (
    mention_count >= 1000 &&
    (window_volatility === null || window_volatility < 0.3)
  ) {
    confidence = "high"
  } else if (
    mention_count >= 200 &&
    (window_volatility === null || window_volatility < 0.6)
  ) {
    confidence = "medium"
  } else {
    confidence = "low"
  }

  // Compute range for non-high confidence
  let half_life_range: { low: number; high: number } | null = null
  if (half_life_months !== null && confidence !== "high") {
    const spread = confidence === "medium" ? 0.4 : 0.7
    half_life_range = {
      low: Math.round(half_life_months * (1 - spread)),
      high: Math.round(half_life_months * (1 + spread)),
    }
  }

  return {
    status,
    half_life_months:
      half_life_months !== null ? Math.round(half_life_months * 10) / 10 : null,
    half_life_range,
    confidence,
    effective_annual_decline_rate: D,
    factors_payload: {
      velocity_score: v,
      mention_count,
      exposure_score: e,
      exposure_category: c,
      window_volatility,
      formula_version: HALF_LIFE_METHODOLOGY_VERSION,
      overrides_applied: overrides,
    },
  }
}
