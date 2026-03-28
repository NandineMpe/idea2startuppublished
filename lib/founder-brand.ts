/**
 * Founder brand workspace — client localStorage.
 */

export const FOUNDER_BRAND_STORAGE_KEY = "juno-founder-brand-v1"

/** Planned conversations / content — your own schedule, not auto-generated. */
export type UpcomingConversationTopic = {
  id: string
  title: string
  /** Talking points, audience, CTA */
  notes: string
  /** URLs — one per line */
  links: string
  /** Supporting media: file locations, B-roll notes, “clip at 0:45”, etc. */
  mediaNotes: string
  /** ISO date (YYYY-MM-DD) or empty */
  scheduledDate: string
  /** Optional time HH:mm for same-day planning */
  scheduledTime: string
}

/** TikTok-oriented digest: AI trends & AI × work — not audit/compliance. */
export type TiktokWorkDigestConfig = {
  /** Future: scheduled runs; UI placeholder for now */
  automationEnabled: boolean
  digestFrequency: "off" | "daily" | "weekly"
  /** Latest digest (plain text / markdown) */
  digestBody: string
  lastDigestAt: string | null
}

export type FounderBrandState = {
  pitchArticulation: string
  brandStrategies: string
  publicPresence: string
  credibilityProof: string
  founderLocation: string
  tiktokWorkDigest: TiktokWorkDigestConfig
  upcomingTopics: UpcomingConversationTopic[]
}

export const DEFAULT_TIKTOK_DIGEST: TiktokWorkDigestConfig = {
  automationEnabled: false,
  digestFrequency: "off",
  digestBody: "",
  lastDigestAt: null,
}

export const DEFAULT_FOUNDER_BRAND: FounderBrandState = {
  pitchArticulation: "",
  brandStrategies: "",
  publicPresence: "",
  credibilityProof: "",
  founderLocation: "",
  tiktokWorkDigest: { ...DEFAULT_TIKTOK_DIGEST },
}

function mergeTiktokDigest(partial: Partial<TiktokWorkDigestConfig> | undefined): TiktokWorkDigestConfig {
  const base = { ...DEFAULT_TIKTOK_DIGEST }
  if (!partial) return base
  return {
    automationEnabled:
      typeof partial.automationEnabled === "boolean" ? partial.automationEnabled : base.automationEnabled,
    digestFrequency:
      partial.digestFrequency === "off" || partial.digestFrequency === "daily" || partial.digestFrequency === "weekly"
        ? partial.digestFrequency
        : base.digestFrequency,
    digestBody: typeof partial.digestBody === "string" ? partial.digestBody : base.digestBody,
    lastDigestAt:
      partial.lastDigestAt === null
        ? null
        : typeof partial.lastDigestAt === "string"
          ? partial.lastDigestAt
          : base.lastDigestAt,
  }
}

export function hydrateFounderBrand(partial: Partial<FounderBrandState> | null): FounderBrandState {
  const base = { ...DEFAULT_FOUNDER_BRAND }
  if (!partial) return base
  return {
    pitchArticulation: typeof partial.pitchArticulation === "string" ? partial.pitchArticulation : base.pitchArticulation,
    brandStrategies: typeof partial.brandStrategies === "string" ? partial.brandStrategies : base.brandStrategies,
    publicPresence: typeof partial.publicPresence === "string" ? partial.publicPresence : base.publicPresence,
    credibilityProof: typeof partial.credibilityProof === "string" ? partial.credibilityProof : base.credibilityProof,
    founderLocation: typeof partial.founderLocation === "string" ? partial.founderLocation : base.founderLocation,
    tiktokWorkDigest: mergeTiktokDigest(partial.tiktokWorkDigest),
    upcomingTopics:
      partial.upcomingTopics !== undefined ? mergeUpcomingTopics(partial.upcomingTopics) : base.upcomingTopics,
  }
}

export function newUpcomingTopicId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `topic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadFounderBrandState(): FounderBrandState {
  if (typeof window === "undefined") return { ...DEFAULT_FOUNDER_BRAND }
  try {
    const raw = localStorage.getItem(FOUNDER_BRAND_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FOUNDER_BRAND }
    return hydrateFounderBrand(JSON.parse(raw) as Partial<FounderBrandState>)
  } catch {
    return { ...DEFAULT_FOUNDER_BRAND }
  }
}

export function saveFounderBrandState(state: FounderBrandState) {
  if (typeof window === "undefined") return
  localStorage.setItem(FOUNDER_BRAND_STORAGE_KEY, JSON.stringify(state))
}
