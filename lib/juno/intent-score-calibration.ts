import { supabaseAdmin } from "@/lib/supabase"

type FeedbackRow = {
  title: string | null
  relevance_score: number | null
  score_feedback: string | null
  subreddit: string | null
}

/**
 * Loads recent per-signal score feedback and turns it into a prompt block for the next scoring run.
 */
export async function buildIntentScoreCalibrationBlock(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("intent_signals")
    .select("title, relevance_score, score_feedback, subreddit")
    .eq("user_id", userId)
    .not("score_feedback", "is", null)
    .order("score_feedback_at", { ascending: false, nullsFirst: false })
    .limit(24)

  if (error || !data?.length) return ""

  const lines = (data as FeedbackRow[]).map((row) => {
    const title = String(row.title ?? "").trim().slice(0, 100)
    const ell = title.length >= 100 ? "..." : ""
    const sub = row.subreddit?.trim() ? `r/${row.subreddit}` : "thread"
    const score = row.relevance_score ?? "?"
    const fb = row.score_feedback
    const label =
      fb === "too_high" ? "too high" : fb === "too_low" ? "too low" : fb === "ok" ? "about right" : String(fb ?? "")
    return `- Model score ${score} (${sub}): user said relevance was ${label} — "${title}${ell}"`
  })

  return `RECENT SCORE FEEDBACK FROM THIS USER (match new scores to these judgments; same company context):
${lines.join("\n")}

Bias: if they often say "too high", score similar threads lower. If they often say "too low", score similar threads higher. "About right" confirms your range. Do not quote these titles back; use only as calibration.`
}
