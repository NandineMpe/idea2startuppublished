/**
 * Shared constants + helpers for the "read-only preview" session flow used by
 * /preview/intelligence/[slug]. The enter route impersonates the target
 * account via a magic link, then drops these cookies so middleware and the
 * dashboard layout can recognise preview traffic.
 */

export const PREVIEW_MODE_COOKIE = "juno_preview_mode"
export const PREVIEW_LABEL_COOKIE = "juno_preview_label"

/** Paths under /api that a preview viewer is still allowed to hit. */
const PREVIEW_API_ALLOWLIST = [
  "/api/preview/",
  "/api/auth/",
]

/** Methods considered mutating; blocked for preview sessions. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export function isPreviewApiAllowed(pathname: string): boolean {
  return PREVIEW_API_ALLOWLIST.some((prefix) => pathname.startsWith(prefix))
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase())
}
