export type CareerHealthPillarKey =
  | "ai_exposure_for_role"
  | "skill_currency"
  | "market_demand"
  | "compensation_positioning"
  | "layoff_risk"
  | "career_velocity"

export type CareerHealthPillarScore = {
  key: CareerHealthPillarKey
  score_0_100: number
  summary: string
  detail: Record<string, unknown>
}

export type CareerHealthStructuredInputs = {
  generated_at_iso: string
  period_label: string
  report_year: number
  report_quarter: number
  profile: {
    current_role_title: string | null
    target_role_title: string | null
    onet_soc_code: string | null
    region_code: string | null
    years_experience: number | null
    current_salary_usd: number | null
  }
  skills: Array<{
    skill_name: string
    canonical_skill_key: string
    half_life_status: string | null
    exposure_score: number | null
    exposure_category: string | null
  }>
  demand: Record<string, unknown>
  salary: Record<string, unknown>
  layoff: Record<string, unknown>
  pillar_scores: CareerHealthPillarScore[]
  composite_score_0_100: number
}
