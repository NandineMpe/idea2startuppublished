import type { LookalikeDimensions } from "@/types/lookalike"

export type LeadForScoring = {
  title: string
  company: string
  location?: string
  department?: string
  companyType?: string
  industry?: string
  companySize?: string
  geography?: string
  isMultiplier?: boolean
}

function scoreDimension(text: string, matchTerms: string[], excludeTerms: string[]): number {
  const lower = text.toLowerCase()
  for (const term of excludeTerms) {
    if (term && lower.includes(term.toLowerCase())) return 0
  }
  let matches = 0
  for (const term of matchTerms) {
    if (term && lower.includes(term.toLowerCase())) matches++
  }
  if (matches === 0) return 0
  if (matches === 1) return 7
  return 10
}

function scoreSize(leadSize: string | undefined, dim: LookalikeDimensions["companySize"]): number {
  if (!leadSize?.trim()) return 5
  const lower = leadSize.toLowerCase()
  for (const r of dim.ranges) {
    if (r && lower.includes(r.toLowerCase().replace(/–/g, "-"))) return 9
  }
  return 4
}

/**
 * Weighted heuristic 0–10 fit score (Layer 1 guardrails, not a statistical model).
 */
export function scoreLeadAgainstProfile(lead: LeadForScoring, profile: LookalikeDimensions): number {
  const d = profile
  let totalScore = 0
  let totalWeight = 0

  const titleScore = scoreDimension(lead.title, d.personTitle.matchTerms, d.personTitle.excludeTerms)
  totalScore += titleScore * d.personTitle.weight
  totalWeight += d.personTitle.weight

  const fnText = `${lead.title} ${lead.department ?? ""}`
  const fnScore = scoreDimension(fnText, d.personFunction.functions, d.personFunction.excludeFunctions)
  totalScore += fnScore * d.personFunction.weight
  totalWeight += d.personFunction.weight

  const coText = `${lead.companyType ?? ""} ${lead.industry ?? ""}`
  const companyScore = scoreDimension(coText, d.companyType.types, d.companyType.excludeTypes)
  totalScore += companyScore * d.companyType.weight
  totalWeight += d.companyType.weight

  const sz = scoreSize(lead.companySize, d.companySize)
  totalScore += sz * d.companySize.weight
  totalWeight += d.companySize.weight

  const geoText = `${lead.location ?? ""} ${lead.geography ?? ""}`
  const geoScore = scoreDimension(geoText, [...d.geography.countries, ...d.geography.cities], [])
  totalScore += geoScore * d.geography.weight
  totalWeight += d.geography.weight

  const indScore = scoreDimension(lead.industry ?? "", d.industryContext.industries, [])
  totalScore += indScore * d.industryContext.weight
  totalWeight += d.industryContext.weight

  if (d.multiplierEffect.isMultiplier && lead.isMultiplier) {
    totalScore += 10 * d.multiplierEffect.weight
  }
  totalWeight += d.multiplierEffect.weight

  if (totalWeight <= 0) return 0
  return Math.round((totalScore / totalWeight) * 10) / 10
}

/** Maps 0–10 heuristic to 0–100 for blending with LLM fit scores. */
export function heuristicToPercent(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score * 10)))
}
