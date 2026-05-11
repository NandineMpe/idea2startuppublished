const MS_7D = 7 * 24 * 60 * 60 * 1000
const MS_90D = 90 * 24 * 60 * 60 * 1000

export function parseModule12CompletedAt(onboardingState: unknown): string | null {
  if (!onboardingState || typeof onboardingState !== "object") return null
  const root = onboardingState as Record<string, unknown>
  const m11 = root.module_1_1
  if (!m11 || typeof m11 !== "object") return null
  const m12 = (m11 as Record<string, unknown>).module_1_2
  if (!m12 || typeof m12 !== "object") return null
  const o = m12 as Record<string, unknown>
  if (o.status !== "completed") return null
  const at = o.completedAt
  return typeof at === "string" && at.trim().length > 0 ? at.trim() : null
}

export function isPastFirstReportEligibleWindow(completedAtIso: string, nowMs: number): boolean {
  const t = Date.parse(completedAtIso)
  if (Number.isNaN(t)) return false
  return nowMs >= t + MS_7D
}

export function isDueForNextReport(lastReportCreatedAtIso: string | null, nowMs: number): boolean {
  if (!lastReportCreatedAtIso) return true
  const t = Date.parse(lastReportCreatedAtIso)
  if (Number.isNaN(t)) return true
  return nowMs >= t + MS_90D
}
