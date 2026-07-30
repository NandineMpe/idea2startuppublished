export type CareerDisplayPreferences = {
  displayName: string | null
  hideEmail: boolean
}

export function parseCareerDisplayPreferences(raw: unknown): CareerDisplayPreferences {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const displayName =
    typeof o.display_name === "string" && o.display_name.trim()
      ? o.display_name.trim().slice(0, 80)
      : null
  return {
    displayName,
    hideEmail: o.hide_email === true,
  }
}

export function careerDisplayPreferencesToJson(prefs: CareerDisplayPreferences): Record<string, unknown> {
  return {
    display_name: prefs.displayName,
    hide_email: prefs.hideEmail,
  }
}

type AuthLikeUser = {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

export function resolveCareerDisplayIdentity(
  prefs: CareerDisplayPreferences,
  user: AuthLikeUser,
): { name: string; email: string | null; initials: string } {
  const mail = user.email?.trim() ?? ""
  const fallbackName =
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    (mail ? mail.split("@")[0] : "") ||
    "Member"
  const name = prefs.displayName || fallbackName
  const email = prefs.hideEmail ? null : mail || null
  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ME"
  return { name, email, initials }
}
