import type { LookalikeDimensions, OutreachPlaybook } from "@/types/lookalike"
import { DEFAULT_DIMENSION_WEIGHTS, emptyPlaybook } from "./defaults"
import { normalizeDimensions, normalizeOutreachPlaybook, normalizeStats } from "./normalize"

export function fallbackDimensionsFromConversion(params: {
  name: string
  title: string
  company: string
  location?: string
}): LookalikeDimensions {
  const base = structuredClone(DEFAULT_DIMENSION_WEIGHTS)
  const titlePart = params.title.split(",")[0]?.trim() || params.title
  base.personTitle.matchTerms = titlePart ? [titlePart.split(" ")[0] || "Partner"] : ["Decision maker"]
  base.geography.countries = params.location ? [params.location] : []
  base.companyType.types = ["professional_services"]
  base.companySize.ranges = ["11–200"]
  return base
}

export function fallbackPlaybook(params: {
  channel: string
  responseTime: string
}): OutreachPlaybook {
  const p = emptyPlaybook()
  p.bestChannel = params.channel
  p.averageResponseTime = params.responseTime
  p.rationale = "Set LLM_API_KEY or OPENROUTER_API_KEY to generate a full lookalike profile and playbook."
  p.bestAngle = "Manual review"
  p.messageTemplate.linkedin = `Hi {name},\n\nI noticed you're {function} at {company} — thought this might resonate.\n\n— {sender_name}`
  p.messageTemplate.email = `Subject: Quick note for {company}\n\nHi {name},\n\nReaching out because of your role as {function} at {company}.\n\nBest,\n{sender_name}`
  return p
}

export function normalizePersistedProfile(row: {
  dimensions: unknown
  outreach_playbook: unknown
  stats: unknown
}): {
  dimensions: LookalikeDimensions
  outreachPlaybook: OutreachPlaybook
  stats: import("@/types/lookalike").LookalikeStats
} {
  return {
    dimensions: normalizeDimensions(row.dimensions),
    outreachPlaybook: normalizeOutreachPlaybook(row.outreach_playbook),
    stats: normalizeStats(row.stats),
  }
}

export { emptyPlaybook }
export { DEFAULT_STATS } from "./defaults"
