import { NextResponse } from "next/server"

/** Client-safe copy for unexpected server failures (no stack, DB, or upstream text). */
export const INTERNAL_ERROR_MESSAGE = "Internal server error"

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

export function logApiError(context: string, error: unknown): void {
  const e = error instanceof Error ? error : new Error(String(error))
  console.error(`[${context}]`, e.message)
  if (e.stack) console.error(e.stack)
}

function toMessage(errorOrMessage: unknown): string {
  if (typeof errorOrMessage === "string") return errorOrMessage
  if (errorOrMessage instanceof Error) return errorOrMessage.message
  return String(errorOrMessage)
}

/**
 * Standard JSON error for API routes. For status 500 or higher, logs the full error and hides details from clients in production.
 */
export function jsonApiError(
  status: number,
  errorOrMessage: unknown,
  context: string,
): NextResponse {
  if (status >= 500) {
    logApiError(context, errorOrMessage)
  }
  const raw = toMessage(errorOrMessage)
  const msg =
    status >= 500 && isProduction()
      ? INTERNAL_ERROR_MESSAGE
      : raw || INTERNAL_ERROR_MESSAGE
  return NextResponse.json({ error: msg }, { status })
}

/**
 * Use inside a custom JSON body when you need `{ error: string }` without wrapping the whole response.
 */
export function safeErrorMessageForClient(error: unknown, fallback = INTERNAL_ERROR_MESSAGE): string {
  if (isProduction()) return INTERNAL_ERROR_MESSAGE
  const m = error instanceof Error ? error.message : fallback
  return m || fallback
}
