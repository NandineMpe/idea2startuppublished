/**
 * GTM hub — channel mix, motion strategy, pricing model (client localStorage).
 * Scoped per signed-in user via gtmHubStorageKey.
 */

export const GTM_HUB_STORAGE_KEY = "juno-gtm-hub-v1"

export function gtmHubStorageKey(userId: string | null | undefined): string {
  const id = userId?.trim()
  return id ? `juno-gtm-hub-v2:${id}` : "juno-gtm-hub-v2:anon"
}

export const CHANNEL_MIX_KEYS = [
  "outbound",
  "social",
  "partners",
  "events",
  "inbound",
  "paid",
] as const

export type ChannelMixKey = (typeof CHANNEL_MIX_KEYS)[number]

export type GtmChannelMix = Record<ChannelMixKey, number>

export const CHANNEL_MIX_LABELS: Record<ChannelMixKey, { title: string; hint: string }> = {
  outbound: { title: "Outbound", hint: "Email, cold outreach, SDR" },
  social: { title: "Social", hint: "LinkedIn, community, founder brand" },
  partners: { title: "Partners", hint: "Resellers, integrations, co-sell" },
  events: { title: "Events", hint: "Field, webinars, conferences" },
  inbound: { title: "Inbound", hint: "Content, SEO, product-led" },
  paid: { title: "Paid", hint: "Ads, sponsored, intent data" },
}

export type GtmMotionStrategy = {
  selfServe: boolean
  topDown: boolean
  proofOfConcept: boolean
}

export type GtmPricingModel = {
  platformFee: string
  payPerUseEnabled: boolean
  payPerUse: string
}

export type GtmHubState = {
  channelMix: GtmChannelMix
  motionStrategy: GtmMotionStrategy
  pricing: GtmPricingModel
}

export const DEFAULT_CHANNEL_MIX: GtmChannelMix = {
  outbound: 25,
  social: 20,
  partners: 15,
  events: 10,
  inbound: 20,
  paid: 10,
}

export const DEFAULT_MOTION_STRATEGY: GtmMotionStrategy = {
  selfServe: true,
  topDown: true,
  proofOfConcept: true,
}

export const DEFAULT_PRICING_MODEL: GtmPricingModel = {
  platformFee: "",
  payPerUseEnabled: true,
  payPerUse: "",
}

export const DEFAULT_GTM_HUB: GtmHubState = {
  channelMix: { ...DEFAULT_CHANNEL_MIX },
  motionStrategy: { ...DEFAULT_MOTION_STRATEGY },
  pricing: { ...DEFAULT_PRICING_MODEL },
}

function clampMix(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(100, Math.round(n))
}

export function hydrateGtmHub(partial: Partial<GtmHubState> | null): GtmHubState {
  const base = structuredClone(DEFAULT_GTM_HUB)
  if (!partial) return base

  const mix = { ...base.channelMix }
  for (const k of CHANNEL_MIX_KEYS) {
    const v = partial.channelMix?.[k]
    mix[k] = typeof v === "number" ? clampMix(v) : base.channelMix[k]
  }

  return {
    channelMix: mix,
    motionStrategy: {
      selfServe: partial.motionStrategy?.selfServe ?? base.motionStrategy.selfServe,
      topDown: partial.motionStrategy?.topDown ?? base.motionStrategy.topDown,
      proofOfConcept: partial.motionStrategy?.proofOfConcept ?? base.motionStrategy.proofOfConcept,
    },
    pricing: {
      platformFee: typeof partial.pricing?.platformFee === "string" ? partial.pricing.platformFee : base.pricing.platformFee,
      payPerUseEnabled:
        typeof partial.pricing?.payPerUseEnabled === "boolean"
          ? partial.pricing.payPerUseEnabled
          : base.pricing.payPerUseEnabled,
      payPerUse: typeof partial.pricing?.payPerUse === "string" ? partial.pricing.payPerUse : base.pricing.payPerUse,
    },
  }
}

export function loadGtmHubState(userId?: string | null): GtmHubState {
  if (typeof window === "undefined") return structuredClone(DEFAULT_GTM_HUB)
  try {
    try {
      localStorage.removeItem(GTM_HUB_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    const key = gtmHubStorageKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) return structuredClone(DEFAULT_GTM_HUB)
    return hydrateGtmHub(JSON.parse(raw) as Partial<GtmHubState>)
  } catch {
    return structuredClone(DEFAULT_GTM_HUB)
  }
}

export function saveGtmHubState(state: GtmHubState, userId?: string | null) {
  if (typeof window === "undefined") return
  localStorage.setItem(gtmHubStorageKey(userId), JSON.stringify(state))
}

/** Sum of channel mix weights (may be ≠ 100). */
export function channelMixSum(mix: GtmChannelMix): number {
  return CHANNEL_MIX_KEYS.reduce((s, k) => s + mix[k], 0)
}

/** Normalize weights so they sum to 100 (or zero if all zero). */
export function normalizeChannelMix(mix: GtmChannelMix): GtmChannelMix {
  const sum = channelMixSum(mix)
  if (sum <= 0) return { ...DEFAULT_CHANNEL_MIX }
  const out = { ...mix }
  for (const k of CHANNEL_MIX_KEYS) {
    out[k] = Math.round((mix[k] / sum) * 100)
  }
  // Fix rounding drift on last key
  const drift = 100 - channelMixSum(out)
  if (drift !== 0 && CHANNEL_MIX_KEYS.length) {
    const last = CHANNEL_MIX_KEYS[CHANNEL_MIX_KEYS.length - 1]
    out[last] = clampMix(out[last] + drift)
  }
  return out
}

/** Percent share of each channel for charts (0–100, sums to ~100). */
export function channelMixShares(mix: GtmChannelMix): Record<ChannelMixKey, number> {
  const sum = channelMixSum(mix)
  if (sum <= 0) {
    const out = {} as Record<ChannelMixKey, number>
    for (const k of CHANNEL_MIX_KEYS) out[k] = 0
    return out
  }
  const out = {} as Record<ChannelMixKey, number>
  for (const k of CHANNEL_MIX_KEYS) {
    out[k] = (mix[k] / sum) * 100
  }
  return out
}
