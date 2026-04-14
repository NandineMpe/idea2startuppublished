import { generateText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import type { CompanyContext } from "@/lib/company-context"
import { REDDIT_SUBREDDITS, REDDIT_SUBREDDIT_SCAN_PRIORITY } from "@/lib/juno/intent-keywords"

export type SubredditSuggestion = { name: string; reason: string }

const SUB_NAME = /^[A-Za-z0-9_]{2,32}$/

function normalizeSubName(raw: string): string | null {
  const s = raw.trim().replace(/^r\//i, "")
  return SUB_NAME.test(s) ? s : null
}

function parseJsonArray(text: string): unknown {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("[")
  const end = cleaned.lastIndexOf("]")
  if (start < 0 || end <= start) throw new Error("No JSON array in response")
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown
}

/**
 * Produces subreddit names for Reddit intent scanning from company context.
 */
export async function suggestSubredditsFromContext(
  context: CompanyContext,
): Promise<SubredditSuggestion[]> {
  if (!isLlmConfigured()) return []

  const { profile, promptBlock, extracted } = context
  const icp = [...(profile.icp ?? []), ...(extracted.icp ?? [])].filter(Boolean).slice(0, 8)

  const user = `You are helping founders choose Reddit communities for customer research.

Company: ${profile.name || "Unknown"}
Industry: ${profile.industry || extracted.vertical || "unknown"}
ICP: ${icp.join(", ").slice(0, 500)}

Context (compressed):
${promptBlock.slice(0, 6000)}

Include at least a few communities where B2B buyers and operators talk about real workflows: how they buy software, what they ignore (cold email, demos), finance leadership, and startup sales motion. Not only product feature threads.

Return a JSON array only. No markdown. Each item: {"name":"subredditName","reason":"one sentence why buyers show up here"}. Use 8 to 12 items. Names must be real subreddit slugs (letters, numbers, underscore only). No r/ prefix. Prefer communities where buyers complain, compare tools, ask for recommendations, or vent about vendors and outreach.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(
        "Reply with a single JSON array. No prose before or after. No em dashes.",
      ),
      messages: [{ role: "user", content: user }],
      maxOutputTokens: 1400,
      abortSignal: AbortSignal.timeout(90_000),
    })
    if (!text?.trim()) return []

    const raw = parseJsonArray(text)
    if (!Array.isArray(raw)) return []

    const out: SubredditSuggestion[] = []
    for (const row of raw) {
      if (!row || typeof row !== "object") continue
      const o = row as Record<string, unknown>
      const name = normalizeSubName(String(o.name ?? ""))
      const reason = String(o.reason ?? "").trim().slice(0, 220)
      if (!name) continue
      out.push({ name: name.toLowerCase(), reason: reason || "Relevant buyer discussion" })
    }
    return out.slice(0, 12)
  } catch (e) {
    console.error("[reddit-subreddit-suggest]", e)
    return []
  }
}

/**
 * Deduped list for Reddit search (per-user saved list, or AI + defaults).
 */
export async function resolveSubredditsForIntentScan(context: CompanyContext): Promise<string[]> {
  const saved = context.profile.reddit_intent_subreddits
  if (saved?.length) {
    const cleaned = [...new Set(saved.map((s) => normalizeSubName(s)).filter(Boolean) as string[])].map((s) =>
      s.toLowerCase(),
    )
    if (cleaned.length > 0) {
      return cleaned.slice(0, 12)
    }
    // Saved list had only invalid names — fall through to AI + defaults instead of scanning zero subs.
  }

  const suggested = await suggestSubredditsFromContext(context)
  const fromAi = suggested.map((s) => s.name.toLowerCase())
  const defaultsLower = [...new Set(REDDIT_SUBREDDITS.map((s) => s.toLowerCase()))]
  const merged = [...new Set([...REDDIT_SUBREDDIT_SCAN_PRIORITY, ...fromAi, ...defaultsLower])]
  return merged.slice(0, 12)
}
