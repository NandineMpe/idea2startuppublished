/**
 * How far back intent monitors (Reddit search, HN Algolia) consider posts.
 * Override with INTENT_LOOKBACK_DAYS (integer). Default 7, clamped 1–365.
 */
const DEFAULT_DAYS = 7
const MIN_DAYS = 1
const MAX_DAYS = 365

function parseLookbackDays(): number {
  const raw = process.env.INTENT_LOOKBACK_DAYS
  if (raw == null || raw.trim() === "") return DEFAULT_DAYS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return DEFAULT_DAYS
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n))
}

/** Cached per process (env does not change at runtime in serverless). */
let cachedDays: number | null = null

export function getIntentLookbackDays(): number {
  if (cachedDays == null) cachedDays = parseLookbackDays()
  return cachedDays
}

export function getIntentLookbackMs(): number {
  return getIntentLookbackDays() * 24 * 60 * 60 * 1000
}

/**
 * Reddit search `t=` must be at least as wide as the lookback window, or older
 * posts never appear in the API response.
 */
export function redditSearchTimeParam(lookbackDays: number): "hour" | "day" | "week" | "month" | "year" | "all" {
  if (lookbackDays <= 1) return "day"
  if (lookbackDays <= 7) return "week"
  if (lookbackDays <= 30) return "month"
  if (lookbackDays <= 365) return "year"
  return "all"
}
