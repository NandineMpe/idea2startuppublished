import { supabaseAdmin } from "@/lib/supabase"

export type ApiRateLimitResult = {
  allowed: boolean
  count: number
  limit: number
  /** Window end (UTC), for Retry-After */
  resetAt: Date
}

function parseResetAt(raw: unknown): Date {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw
  if (typeof raw === "string") {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date(Date.now() + 3600_000)
}

/**
 * Atomically increments usage for (user, feature) in the current time bucket.
 * Use for expensive upstream calls (LLM, agent APIs). Requires service role.
 */
export async function checkAndIncrementApiRateLimit(
  userId: string,
  feature: string,
  limit: number,
  windowSeconds: number,
): Promise<ApiRateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc("check_and_increment_api_rate_limit", {
    p_user_id: userId,
    p_feature: feature,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`)
  }
  const row = data as {
    allowed?: boolean
    count?: number
    limit?: number
    reset_at?: unknown
  }
  const allowed = row.allowed === true
  const count = typeof row.count === "number" ? row.count : 0
  const lim = typeof row.limit === "number" ? row.limit : limit
  const resetAt = parseResetAt(row.reset_at)
  return { allowed, count, limit: lim, resetAt }
}
