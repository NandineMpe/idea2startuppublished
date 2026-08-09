import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRow } from "./query"
import { KILL_REASONS, type CreatorKillReason, type CreatorTaste } from "./types"

export async function loadTaste(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreatorTaste | null> {
  return safeRow<CreatorTaste>(
    supabase
      .schema("creator")
      .from("creator_taste")
      .select("window_start,window_end,approve_count,kill_count,kill_counts,exemplars,rebuilt_at")
      .eq("user_id", userId)
      .maybeSingle(),
  )
}

const LABEL = new Map(KILL_REASONS.map((r) => [r.id as string, r]))

/**
 * The taste profile as every agent sees it.
 *
 * Below a floor of decisions this returns nothing at all. Six kills is not a
 * taste, it is a week, and a model handed three data points will treat them as
 * a law and start refusing whole categories on the strength of a bad Tuesday.
 * Saying nothing is the honest output of a profile that does not exist yet.
 */
const MIN_DECISIONS_TO_SPEAK = 12

export function tasteBlock(taste: CreatorTaste | null): string {
  if (!taste) return ""
  const total = taste.approve_count + taste.kill_count
  if (total < MIN_DECISIONS_TO_SPEAK) return ""

  const ranked = Object.entries(taste.kill_counts ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
  if (!ranked.length) return ""

  const lines = ranked.map(([reason, count]) => {
    const meta = LABEL.get(reason)
    const share = Math.round(((count ?? 0) / Math.max(1, taste.kill_count)) * 100)
    const examples = (taste.exemplars?.[reason as CreatorKillReason] ?? [])
      .slice(0, 3)
      .map((e) => `    - "${e.subject}"${e.note ? ` (they said: ${e.note})` : ""}`)
      .join("\n")
    return `- ${meta?.label ?? reason} (${count}, ${share}% of kills): ${meta?.hint ?? ""}${
      examples ? `\n${examples}` : ""
    }`
  })

  return [
    `WHAT THIS CREATOR HAS ALREADY REJECTED (${taste.kill_count} kills against ${taste.approve_count} approvals, last 8 weeks):`,
    ...lines,
    "",
    "These are not preferences to weigh. They are vetoes. If a candidate you are about to propose would attract the reason at the top of that list, do not propose it, and do not propose a lightly reworded version of it either.",
  ].join("\n")
}

/**
 * The precedence line.
 *
 * Stated explicitly because three context blocks arrive in the same prompt and
 * a model handed three sources of direction will average them. Averaging is the
 * one thing that must not happen here: the canon is the largest and most
 * concrete of the three and would win on volume alone, which is exactly the
 * failure the trajectory was introduced to fix.
 */
export const PRECEDENCE_RULE = `HOW TO READ THE THREE BLOCKS BELOW. The trajectory sets direction. The taste profile vetoes. The canon sets voice. Where the trajectory and the canon conflict, the trajectory wins. Where the taste profile rules something out, it is out regardless of the other two.`
