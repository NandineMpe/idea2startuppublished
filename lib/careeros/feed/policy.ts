export type FeedUserSeniority = "entry" | "junior" | "mid" | "senior" | "staff"
export type FeedRoleFamily =
  | "software-engineering"
  | "data-ai"
  | "product-management"
  | "design"
  | "security"
  | "operations"
  | "generalist"

export type FunctionProfile = {
  primary_family: FeedRoleFamily
  families: FeedRoleFamily[]
  confidence: number
}

export type ItemFunctionClassification = {
  primary_family: FeedRoleFamily
  confidence: number
  compatible_families: FeedRoleFamily[]
}

export type EngagementSignals = {
  open_rate_30d: number
  dismiss_rate_30d: number
  save_rate_30d: number
}

export type UserSegment = `${FeedRoleFamily}:${FeedUserSeniority}`

const ROLE_FAMILY_KEYWORDS: Array<{ family: FeedRoleFamily; rx: RegExp }> = [
  { family: "software-engineering", rx: /(backend|frontend|full[- ]?stack|software|engineer|developer|platform|sre|devops)/i },
  { family: "data-ai", rx: /(data scientist|machine learning|ml engineer|ai engineer|analytics engineer|data engineer)/i },
  { family: "product-management", rx: /(product manager|product owner|program manager|growth manager)/i },
  { family: "design", rx: /(designer|ux|ui|product design|visual design|interaction design)/i },
  { family: "security", rx: /(security|application security|soc analyst|infosec|cybersecurity)/i },
  { family: "operations", rx: /(operations|it support|systems administrator|network engineer|reliability)/i },
]

const SKILL_HINTS: Array<{ family: FeedRoleFamily; rx: RegExp }> = [
  { family: "software-engineering", rx: /(typescript|javascript|java|golang|python|api-design|kubernetes|react|node)/i },
  { family: "data-ai", rx: /(machine-learning|ml|llm|ai-agents|ai-llm|data-engineering|sql|pytorch|tensorflow)/i },
  { family: "design", rx: /(figma|user-research|wireframing|interaction-design|visual-design|typography)/i },
  { family: "product-management", rx: /(roadmap|product-strategy|user-story|experimentation|product-analytics)/i },
  { family: "security", rx: /(threat-modeling|owasp|siem|incident-response|cybersecurity)/i },
]

const SOC_PREFIX_TO_FAMILY: Record<string, FeedRoleFamily> = {
  "15-12": "software-engineering",
  "15-20": "data-ai",
  "15-12.": "software-engineering",
  "15-20.": "data-ai",
  "15-121": "software-engineering",
  "15-125": "software-engineering",
  "15-205": "data-ai",
  "15-204": "data-ai",
  "17-21": "design",
}

const BASE_THRESHOLDS: Record<UserSegment, number> = {
  "software-engineering:entry": 0.56,
  "software-engineering:junior": 0.57,
  "software-engineering:mid": 0.58,
  "software-engineering:senior": 0.6,
  "software-engineering:staff": 0.61,
  "data-ai:entry": 0.55,
  "data-ai:junior": 0.56,
  "data-ai:mid": 0.57,
  "data-ai:senior": 0.59,
  "data-ai:staff": 0.6,
  "product-management:entry": 0.55,
  "product-management:junior": 0.56,
  "product-management:mid": 0.58,
  "product-management:senior": 0.59,
  "product-management:staff": 0.6,
  "design:entry": 0.55,
  "design:junior": 0.56,
  "design:mid": 0.58,
  "design:senior": 0.59,
  "design:staff": 0.6,
  "security:entry": 0.56,
  "security:junior": 0.57,
  "security:mid": 0.59,
  "security:senior": 0.6,
  "security:staff": 0.62,
  "operations:entry": 0.55,
  "operations:junior": 0.56,
  "operations:mid": 0.57,
  "operations:senior": 0.59,
  "operations:staff": 0.6,
  "generalist:entry": 0.55,
  "generalist:junior": 0.56,
  "generalist:mid": 0.57,
  "generalist:senior": 0.59,
  "generalist:staff": 0.6,
}

export const WEEKLY_ITEM_FLOOR = 3
export const WEEKLY_ITEM_MAX = 5

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v))
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-")
}

function familiesFromSoc(onetSocCode: string | null): FeedRoleFamily[] {
  if (!onetSocCode) return []
  const soc = onetSocCode.trim()
  const out = new Set<FeedRoleFamily>()
  for (const [prefix, family] of Object.entries(SOC_PREFIX_TO_FAMILY)) {
    if (soc.startsWith(prefix)) out.add(family)
  }
  return [...out]
}

export function deriveFunctionProfile(params: {
  currentRoleTitle: string | null
  onetSocCode: string | null
  skills: string[]
}): FunctionProfile {
  const roleTitle = String(params.currentRoleTitle ?? "")
  const bySignals = new Map<FeedRoleFamily, number>()
  for (const { family, rx } of ROLE_FAMILY_KEYWORDS) {
    if (rx.test(roleTitle)) bySignals.set(family, (bySignals.get(family) ?? 0) + 2)
  }
  for (const fam of familiesFromSoc(params.onetSocCode)) {
    bySignals.set(fam, (bySignals.get(fam) ?? 0) + 2)
  }
  for (const skill of params.skills.map(normalizeSkill)) {
    for (const { family, rx } of SKILL_HINTS) {
      if (rx.test(skill)) bySignals.set(family, (bySignals.get(family) ?? 0) + 1)
    }
  }
  if (bySignals.size === 0) {
    return { primary_family: "generalist", families: ["generalist"], confidence: 0.45 }
  }
  const ranked = [...bySignals.entries()].sort((a, b) => b[1] - a[1])
  const top = ranked[0] ?? ["generalist", 1]
  const second = ranked[1] ?? ["generalist", 0]
  const confidence = clamp(0.55 + (Number(top[1]) - Number(second[1])) * 0.08, 0.55, 0.95)
  const families = ranked
    .filter(([, score]) => score >= Number(top[1]) - 1)
    .map(([family]) => family)
  return {
    primary_family: String(top[0]) as FeedRoleFamily,
    families: families.length > 0 ? (families as FeedRoleFamily[]) : [String(top[0]) as FeedRoleFamily],
    confidence: Number(confidence.toFixed(2)),
  }
}

export function classifyItemFunction(params: {
  affectedFunctions: string[]
  title: string
  summary: string
  affectedSkills: string[]
}): ItemFunctionClassification {
  const bySignals = new Map<FeedRoleFamily, number>()
  const stack = `${params.title}\n${params.summary}\n${params.affectedSkills.join(" ")}`
  for (const value of params.affectedFunctions) {
    const v = value.toLowerCase()
    if (v.includes("software") || v.includes("engineering")) bySignals.set("software-engineering", (bySignals.get("software-engineering") ?? 0) + 2)
    if (v.includes("data") || v.includes("ai")) bySignals.set("data-ai", (bySignals.get("data-ai") ?? 0) + 2)
    if (v.includes("product")) bySignals.set("product-management", (bySignals.get("product-management") ?? 0) + 2)
    if (v.includes("design")) bySignals.set("design", (bySignals.get("design") ?? 0) + 2)
    if (v.includes("security")) bySignals.set("security", (bySignals.get("security") ?? 0) + 2)
    if (v.includes("operations")) bySignals.set("operations", (bySignals.get("operations") ?? 0) + 2)
  }
  for (const { family, rx } of ROLE_FAMILY_KEYWORDS) {
    if (rx.test(stack)) bySignals.set(family, (bySignals.get(family) ?? 0) + 1)
  }
  for (const { family, rx } of SKILL_HINTS) {
    if (rx.test(stack)) bySignals.set(family, (bySignals.get(family) ?? 0) + 1)
  }
  if (bySignals.size === 0) {
    return { primary_family: "generalist", confidence: 0.5, compatible_families: ["generalist"] }
  }
  const ranked = [...bySignals.entries()].sort((a, b) => b[1] - a[1])
  const top = ranked[0]!
  const second = ranked[1] ?? ["generalist", 0]
  const confidence = clamp(0.52 + (Number(top[1]) - Number(second[1])) * 0.1, 0.52, 0.96)
  const compatible = ranked
    .filter(([, score]) => score >= Number(top[1]) - 1)
    .map(([family]) => family as FeedRoleFamily)
  return {
    primary_family: top[0] as FeedRoleFamily,
    confidence: Number(confidence.toFixed(2)),
    compatible_families: compatible.length > 0 ? compatible : [top[0] as FeedRoleFamily],
  }
}

export function resolveUserSegment(family: FeedRoleFamily, seniority: FeedUserSeniority): UserSegment {
  return `${family}:${seniority}`
}

export function adaptiveThreshold(params: {
  segment: UserSegment
  engagement: EngagementSignals
  baseThreshold?: number
}) {
  const base = params.baseThreshold ?? BASE_THRESHOLDS[params.segment] ?? 0.58
  const openAdj = (0.45 - clamp(params.engagement.open_rate_30d, 0, 1)) * 0.06
  const dismissAdj = clamp(params.engagement.dismiss_rate_30d - 0.18, -0.1, 0.6) * 0.08
  const saveAdj = (0.05 - clamp(params.engagement.save_rate_30d, 0, 1)) * 0.04
  const threshold = clamp(base + openAdj + dismissAdj + saveAdj, 0.48, 0.78)
  return Number(threshold.toFixed(3))
}

export function evaluatePolicyGate(params: {
  relevanceScore: number
  adaptiveThreshold: number
  currentWeeklyDelivered: number
  functionProfile: FunctionProfile
  itemFunction: ItemFunctionClassification
  significance: number
  overlapScore: number
}) {
  const belowFloor = params.currentWeeklyDelivered < WEEKLY_ITEM_FLOOR
  if (params.currentWeeklyDelivered >= WEEKLY_ITEM_MAX) {
    return {
      allow: false,
      reasonCode: "weekly_quota_reached",
      servingPolicy: "none",
      appliedThreshold: params.adaptiveThreshold,
      belowFloor,
    } as const
  }

  const hardMismatch =
    params.itemFunction.confidence >= 0.7 &&
    !params.itemFunction.compatible_families.includes("generalist") &&
    !params.functionProfile.families.some((family) => params.itemFunction.compatible_families.includes(family))

  const override =
    params.itemFunction.confidence >= 0.85 &&
    params.significance >= 0.92 &&
    params.overlapScore >= 0.5 &&
    params.relevanceScore >= params.adaptiveThreshold + 0.06

  if (hardMismatch && !override) {
    return {
      allow: false,
      reasonCode: "function_incompatible_hard_negative",
      servingPolicy: "none",
      appliedThreshold: params.adaptiveThreshold,
      belowFloor,
    } as const
  }

  const floorThreshold = clamp(params.adaptiveThreshold - 0.06, 0.48, 0.75)
  const thresholdToUse = belowFloor ? floorThreshold : params.adaptiveThreshold
  if (params.relevanceScore < thresholdToUse) {
    return {
      allow: false,
      reasonCode: belowFloor ? "below_floor_backfill_threshold" : "below_standard_threshold",
      servingPolicy: "none",
      appliedThreshold: thresholdToUse,
      belowFloor,
    } as const
  }

  return {
    allow: true,
    reasonCode: belowFloor ? "served_under_floor_backfill" : "served_under_standard_threshold",
    servingPolicy: belowFloor ? "served_under_floor_backfill" : "served_under_standard_threshold",
    appliedThreshold: thresholdToUse,
    belowFloor,
  } as const
}
