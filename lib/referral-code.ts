/** Shared validation for `?ref=` query and `juno_ref` cookie (Edge-safe, no server-only). */

export function normalizeReferralCodeParam(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase()
  if (!t || t.length < 6 || t.length > 12) return null
  if (!/^[a-z0-9]+$/.test(t)) return null
  return t
}
