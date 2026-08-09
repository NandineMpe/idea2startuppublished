import type { SupabaseClient } from "@supabase/supabase-js"
import type { CreatorKillReason } from "@/lib/creator/types"

/**
 * Roll every decision in the window into one bounded profile.
 *
 * No model call. This is counting, and paying Opus to count would be an
 * expensive way to introduce errors into arithmetic.
 *
 * The window is deliberately trailing rather than all-time. Taste moves: the
 * creator repositioning away from Big Four schadenfreude means last quarter's
 * kills describe someone who no longer exists, and an all-time profile would
 * hold them there.
 */

const WINDOW_DAYS = 56
const MAX_EXEMPLARS_PER_REASON = 3

type DecisionRow = {
  decision: string
  reason: CreatorKillReason | null
  subject: string | null
  note: string | null
  decided_at: string
}

export type TasteRebuildResult = {
  approve_count: number
  kill_count: number
  reasons: number
}

export async function rebuildTasteForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<TasteRebuildResult> {
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000)
  const windowEnd = new Date()

  const { data, error } = await supabase
    .schema("creator")
    .from("creator_decisions")
    .select("decision,reason,subject,note,decided_at")
    .eq("user_id", userId)
    .gte("decided_at", windowStart.toISOString())
    .order("decided_at", { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as DecisionRow[]

  const killCounts: Partial<Record<CreatorKillReason, number>> = {}
  const exemplars: Partial<Record<CreatorKillReason, Array<{ subject: string; note: string | null }>>> = {}
  let approveCount = 0
  let killCount = 0

  for (const row of rows) {
    if (row.decision === "approve") {
      approveCount++
      continue
    }
    if (row.decision !== "kill" || !row.reason) continue
    killCount++
    killCounts[row.reason] = (killCounts[row.reason] ?? 0) + 1

    // Newest first, because rows arrive newest first and the most recent
    // examples are the ones that still describe the creator.
    const bucket = (exemplars[row.reason] ??= [])
    if (bucket.length < MAX_EXEMPLARS_PER_REASON && row.subject) {
      bucket.push({ subject: row.subject, note: row.note })
    }
  }

  const { error: writeError } = await supabase
    .schema("creator")
    .from("creator_taste")
    .upsert(
      {
        user_id: userId,
        window_start: windowStart.toISOString(),
        window_end: windowEnd.toISOString(),
        approve_count: approveCount,
        kill_count: killCount,
        kill_counts: killCounts,
        exemplars,
        rebuilt_at: windowEnd.toISOString(),
      },
      { onConflict: "user_id" },
    )
  if (writeError) throw writeError

  return {
    approve_count: approveCount,
    kill_count: killCount,
    reasons: Object.keys(killCounts).length,
  }
}
