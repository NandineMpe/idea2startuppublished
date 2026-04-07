import { supabaseAdmin } from "@/lib/supabase"

type FeedbackRow = {
  id: string
  title: string | null
  relevance_score: number | null
  score_feedback: string | null
  subreddit: string | null
}

type IrrelevantRow = {
  id: string
  title: string | null
  relevance_score: number | null
  subreddit: string | null
}

function formatTitleSnippet(title: string | null): { line: string; ell: string } {
  const t = String(title ?? "").trim().slice(0, 100)
  return { line: t, ell: t.length >= 100 ? "..." : "" }
}

/**
 * Loads recent explicit score feedback plus threads marked not relevant, for the next scoring prompt.
 */
export async function buildIntentScoreCalibrationBlock(userId: string): Promise<string> {
  const [feedbackRes, irrelevantRes] = await Promise.all([
    supabaseAdmin
      .from("intent_signals")
      .select("id, title, relevance_score, score_feedback, subreddit")
      .eq("user_id", userId)
      .not("score_feedback", "is", null)
      .order("score_feedback_at", { ascending: false, nullsFirst: false })
      .limit(24),
    supabaseAdmin
      .from("intent_signals")
      .select("id, title, relevance_score, subreddit")
      .eq("user_id", userId)
      .eq("status", "irrelevant")
      .order("discovered_at", { ascending: false })
      .limit(32),
  ])

  const explicit = (feedbackRes.error ? [] : (feedbackRes.data ?? [])) as FeedbackRow[]
  const feedbackIds = new Set(explicit.map((r) => r.id))

  const irrelevant = (irrelevantRes.error ? [] : irrelevantRes.data ?? [])
    .filter((r): r is IrrelevantRow => typeof (r as IrrelevantRow).id === "string")
    .filter((r) => !feedbackIds.has(r.id))
    .slice(0, 18)

  const explicitLines = explicit.map((row) => {
    const { line, ell } = formatTitleSnippet(row.title)
    const sub = row.subreddit?.trim() ? `r/${row.subreddit}` : "thread"
    const score = row.relevance_score ?? "?"
    const fb = row.score_feedback
    const label =
      fb === "too_high" ? "too high" : fb === "too_low" ? "too low" : fb === "ok" ? "about right" : String(fb ?? "")
    return `- Model score ${score} (${sub}): user said relevance was ${label} — "${line}${ell}"`
  })

  const irrelevantLines = irrelevant.map((row) => {
    const { line, ell } = formatTitleSnippet(row.title)
    const sub = row.subreddit?.trim() ? `r/${row.subreddit}` : "thread"
    const score = row.relevance_score ?? "?"
    return `- Model score ${score} (${sub}): user marked NOT RELEVANT (not a fit) — "${line}${ell}"`
  })

  if (explicitLines.length === 0 && irrelevantLines.length === 0) return ""

  const sections: string[] = []
  if (explicitLines.length > 0) {
    sections.push(`SCORE FIT (explicit buttons):\n${explicitLines.join("\n")}`)
  }
  if (irrelevantLines.length > 0) {
    sections.push(`MARKED NOT RELEVANT:\n${irrelevantLines.join("\n")}`)
  }

  return `RECENT CALIBRATION FROM THIS USER (same company context):
${sections.join("\n\n")}

Bias: "too high" and NOT RELEVANT both mean you should score similar threads lower. "Too low" means score similar threads higher. "About right" confirms the band. Do not quote titles verbatim; use only as calibration.`
}
