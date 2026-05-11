/**
 * Rolling demand windows (Module 2.1). All windows end on `window_end` (typically refresh run date).
 * Formula reference: docs/careeros/data-sources.md — Demand trajectory windows.
 */
export const DEMAND_WINDOW_CODES = ["M30", "M90", "M180", "M360", "M720"] as const

export type DemandWindowCode = (typeof DEMAND_WINDOW_CODES)[number]

/** Rolling lookback in days from window_end (inclusive span semantics handled at API layer). */
export const DEMAND_WINDOW_DAYS: Record<DemandWindowCode, number> = {
  M30: 30,
  M90: 90,
  M180: 180,
  M360: 360,
  M720: 720,
}

export function windowStartFromEnd(windowEnd: Date, code: DemandWindowCode): Date {
  const days = DEMAND_WINDOW_DAYS[code]
  const d = new Date(windowEnd)
  d.setUTCDate(d.getUTCDate() - days)
  return d
}
