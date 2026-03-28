import type {
  CompanySizeDimension,
  CompanyTypeDimension,
  GeographyDimension,
  IndustryContextDimension,
  LookalikeDimensions,
  MultiplierEffectDimension,
  OutreachPlaybook,
  PersonFunctionDimension,
  PersonTitleDimension,
  LookalikeStats,
} from "@/types/lookalike"
import { DEFAULT_DIMENSION_WEIGHTS, DEFAULT_STATS, emptyPlaybook } from "./defaults"

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x ?? "").trim()).filter(Boolean)
}

function mergeTitle(raw: Partial<PersonTitleDimension> | undefined): PersonTitleDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.personTitle
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    matchTerms: asStrArr(raw?.matchTerms).length ? asStrArr(raw?.matchTerms) : d.matchTerms,
    excludeTerms: asStrArr(raw?.excludeTerms),
    seniorityMin:
      raw?.seniorityMin === "director" ||
      raw?.seniorityMin === "vp" ||
      raw?.seniorityMin === "c_level" ||
      raw?.seniorityMin === "partner"
        ? raw.seniorityMin
        : d.seniorityMin,
  }
}

function mergeFn(raw: Partial<PersonFunctionDimension> | undefined): PersonFunctionDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.personFunction
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    functions: asStrArr(raw?.functions).length ? asStrArr(raw?.functions) : d.functions,
    excludeFunctions: asStrArr(raw?.excludeFunctions),
  }
}

function mergeCo(raw: Partial<CompanyTypeDimension> | undefined): CompanyTypeDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.companyType
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    types: asStrArr(raw?.types).length ? asStrArr(raw?.types) : d.types,
    excludeTypes: asStrArr(raw?.excludeTypes),
  }
}

function mergeSize(raw: Partial<CompanySizeDimension> | undefined): CompanySizeDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.companySize
  const minE = raw?.minEmployees
  const maxE = raw?.maxEmployees
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    minEmployees: typeof minE === "number" && Number.isFinite(minE) ? minE : null,
    maxEmployees: typeof maxE === "number" && Number.isFinite(maxE) ? maxE : null,
    ranges: asStrArr(raw?.ranges).length ? asStrArr(raw?.ranges) : d.ranges,
  }
}

function mergeGeo(raw: Partial<GeographyDimension> | undefined): GeographyDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.geography
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    countries: asStrArr(raw?.countries).length ? asStrArr(raw?.countries) : d.countries,
    cities: asStrArr(raw?.cities),
    regions: asStrArr(raw?.regions),
  }
}

function mergeInd(raw: Partial<IndustryContextDimension> | undefined): IndustryContextDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.industryContext
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    industries: asStrArr(raw?.industries).length ? asStrArr(raw?.industries) : d.industries,
    subVerticals: asStrArr(raw?.subVerticals),
  }
}

function mergeMult(raw: Partial<MultiplierEffectDimension> | undefined): MultiplierEffectDimension {
  const d = DEFAULT_DIMENSION_WEIGHTS.multiplierEffect
  const reach = raw?.estimatedReach
  return {
    weight: typeof raw?.weight === "number" ? Math.min(100, Math.max(0, raw.weight)) : d.weight,
    isMultiplier: typeof raw?.isMultiplier === "boolean" ? raw.isMultiplier : d.isMultiplier,
    multiplierType: raw?.multiplierType != null ? String(raw.multiplierType) : null,
    estimatedReach: typeof reach === "number" && Number.isFinite(reach) ? reach : null,
  }
}

export function normalizeDimensions(raw: unknown): LookalikeDimensions {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_DIMENSION_WEIGHTS)
  const o = raw as Record<string, unknown>
  return {
    personTitle: mergeTitle(o.personTitle as Partial<PersonTitleDimension>),
    personFunction: mergeFn(o.personFunction as Partial<PersonFunctionDimension>),
    companyType: mergeCo(o.companyType as Partial<CompanyTypeDimension>),
    companySize: mergeSize(o.companySize as Partial<CompanySizeDimension>),
    geography: mergeGeo(o.geography as Partial<GeographyDimension>),
    industryContext: mergeInd(o.industryContext as Partial<IndustryContextDimension>),
    multiplierEffect: mergeMult(o.multiplierEffect as Partial<MultiplierEffectDimension>),
  }
}

export function normalizeOutreachPlaybook(raw: unknown): OutreachPlaybook {
  const base = emptyPlaybook()
  if (!raw || typeof raw !== "object") return base
  const o = raw as Record<string, unknown>
  const mt = o.messageTemplate as Record<string, unknown> | undefined
  return {
    bestChannel: String(o.bestChannel ?? base.bestChannel),
    bestDayOfWeek: o.bestDayOfWeek != null ? String(o.bestDayOfWeek) : null,
    bestAngle: String(o.bestAngle ?? base.bestAngle),
    averageResponseTime: o.averageResponseTime != null ? String(o.averageResponseTime) : null,
    rationale: String(o.rationale ?? base.rationale),
    messageTemplate: {
      linkedin: String(mt?.linkedin ?? base.messageTemplate.linkedin),
      email: String(mt?.email ?? base.messageTemplate.email),
    },
  }
}

export function normalizeStats(raw: unknown): LookalikeStats {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_STATS }
  const o = raw as Record<string, unknown>
  const g = (k: keyof LookalikeStats) =>
    typeof o[k] === "number" && Number.isFinite(o[k] as number) ? (o[k] as number) : DEFAULT_STATS[k]
  return {
    totalGenerated: g("totalGenerated"),
    totalContacted: g("totalContacted"),
    replies: g("replies"),
    meetings: g("meetings"),
    closed: g("closed"),
    replyRate: typeof o.replyRate === "number" ? o.replyRate : null,
    meetingRate: typeof o.meetingRate === "number" ? o.meetingRate : null,
    conversionRate: typeof o.conversionRate === "number" ? o.conversionRate : null,
    outcomeCountAtLastRefine: g("outcomeCountAtLastRefine"),
  }
}
