import Anthropic from "@anthropic-ai/sdk"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import type { CompanyContext } from "@/lib/company-context"
import type { IntentSignal } from "@/lib/juno/intent-monitor"

const anthropic = new Anthropic()

export type ResponsePlatform = "reddit_comment" | "linkedin_dm" | "x_reply" | "direct_email" | "hn_reply"

export type UrgencyLevel = "respond_now" | "this_week" | "monitor"

export interface ScoredIntent extends IntentSignal {
  relevanceScore: number
  whyRelevant: string
  suggestedResponse: string
  responsePlatform: ResponsePlatform
  urgency: UrgencyLevel
}

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((c): c is Anthropic.Messages.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("")
}

function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Score a batch of intent signals with Claude — helpful, non-salesy reply drafts.
 */
export async function scoreIntentSignals(
  signals: IntentSignal[],
  context: CompanyContext,
): Promise<ScoredIntent[]> {
  if (signals.length === 0) return []
  if (!hasAnthropicKey()) {
    return signals.map((s) => ({
      ...s,
      relevanceScore: 5,
      whyRelevant: "ANTHROPIC_API_KEY missing — manual review.",
      suggestedResponse: "",
      responsePlatform: s.platform === "hn" ? "hn_reply" : "reddit_comment",
      urgency: "monitor" as const,
    }))
  }

  const out: ScoredIntent[] = []
  const chunkSize = 6

  for (let i = 0; i < signals.length; i += chunkSize) {
    const chunk = signals.slice(i, i + chunkSize)

    const prompt = `You are a sales intelligence analyst monitoring the internet for people who may need a product like ours.

OUR COMPANY:
${context.promptBlock}

INTENT SIGNALS (JSON array of public posts/comments):
${JSON.stringify(
      chunk.map((s) => ({
        url: s.url,
        platform: s.platform,
        type: s.type,
        title: s.title,
        body: s.body,
        author: s.author,
        subreddit: s.subreddit,
        matchedKeywords: s.matchedKeywords,
      })),
      null,
      2,
    )}

For EACH signal, return one object in a JSON array with this exact shape:
{
  "url": "same as input",
  "relevanceScore": <1-10 integer>,
  "whyRelevant": "1-3 sentences: why this thread matters for our ICP",
  "suggestedResponse": "Draft a helpful reply that does NOT sell. Lead with genuine insight (founder's Big Four / technical accounting background where relevant). Answer their question or validate pain. Match Reddit vs HN tone. Only mention our company naturally if there's a clear opening — never pitch. No 'DM me', no 'check out our product'.",
  "responsePlatform": "reddit_comment" | "hn_reply" | "linkedin_dm" | "x_reply" | "direct_email",
  "urgency": "respond_now" | "this_week" | "monitor"
}

Scoring guide:
- 9-10: Actively looking for what we build or exact pain we solve.
- 7-8: Strong problem-signal we can help with.
- 5-6: Related; could add value carefully.
- 4: Tangential but worth a glance; we may still save for review.
- Below 4: skip (we will filter).

Return ONLY a valid JSON array, no markdown fences.`

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 6000,
        messages: [{ role: "user", content: appendWritingRules(prompt) }],
      })

      const text = extractText(response)
      const match = text.match(/\[[\s\S]*\]/)
      const parsed = match ? (JSON.parse(match[0]) as unknown) : []
      const rows = Array.isArray(parsed) ? parsed : []

      const byUrl = new Map<string, Record<string, unknown>>()
      for (const row of rows) {
        if (row && typeof row === "object" && "url" in row) {
          const u = String((row as { url: string }).url).trim()
          byUrl.set(u.split("?")[0], row as Record<string, unknown>)
        }
      }

      type RowShape = {
        relevanceScore?: number
        whyRelevant?: string
        suggestedResponse?: string
        responsePlatform?: string
        urgency?: string
      }

      for (let idx = 0; idx < chunk.length; idx++) {
        const s = chunk[idx]
        const key = s.url.split("?")[0]
        const fromUrl = byUrl.get(key) as RowShape | undefined
        const fromIdx = rows[idx] as RowShape | undefined
        const r = fromUrl ?? fromIdx

        const score =
          typeof r?.relevanceScore === "number"
            ? Math.min(10, Math.max(1, Math.round(r.relevanceScore)))
            : 5

        const responsePlatform = normalizePlatform(r?.responsePlatform, s.platform)
        const urgency = normalizeUrgency(r?.urgency)

        out.push({
          ...s,
          relevanceScore: score,
          whyRelevant: typeof r?.whyRelevant === "string" ? r.whyRelevant : "",
          suggestedResponse: typeof r?.suggestedResponse === "string" ? r.suggestedResponse : "",
          responsePlatform,
          urgency,
        })
      }
    } catch (e) {
      console.error("[intent-scoring] Claude batch failed:", e)
      for (const s of chunk) {
        out.push({
          ...s,
          relevanceScore: 5,
          whyRelevant: "Scoring failed — review manually.",
          suggestedResponse: "",
          responsePlatform: s.platform === "hn" ? "hn_reply" : "reddit_comment",
          urgency: "monitor",
        })
      }
    }
  }

  return out
}

function normalizePlatform(raw: string | undefined, platform: IntentSignal["platform"]): ResponsePlatform {
  const r = (raw ?? "").toLowerCase()
  if (r.includes("hn") || r === "hn_reply") return "hn_reply"
  if (r.includes("reddit")) return "reddit_comment"
  if (r.includes("linkedin")) return "linkedin_dm"
  if (r.includes("x_") || r.includes("twitter")) return "x_reply"
  if (r.includes("email")) return "direct_email"
  return platform === "hn" ? "hn_reply" : "reddit_comment"
}

function normalizeUrgency(raw: string | undefined): UrgencyLevel {
  const r = (raw ?? "").toLowerCase()
  if (r.includes("now")) return "respond_now"
  if (r.includes("week")) return "this_week"
  return "monitor"
}
