import { appendWritingRules } from "@/lib/copy-writing-rules"
import type { CompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import type { IntentSignal } from "@/lib/juno/intent-monitor"
import { generateText } from "ai"

export type ResponsePlatform = "reddit_comment" | "linkedin_dm" | "x_reply" | "direct_email" | "hn_reply"

export type UrgencyLevel = "respond_now" | "this_week" | "monitor"

export interface ScoredIntent extends IntentSignal {
  relevanceScore: number
  whyRelevant: string
  suggestedResponse: string
  responsePlatform: ResponsePlatform
  urgency: UrgencyLevel
}

function defaultResponsePlatform(platform: IntentSignal["platform"]): ResponsePlatform {
  if (platform === "hn") return "hn_reply"
  if (platform === "x") return "x_reply"
  if (platform === "linkedin") return "linkedin_dm"
  return "reddit_comment"
}

/**
 * Score a batch of Reddit intent signals and generate helpful, non-salesy reply drafts.
 */
export async function scoreIntentSignals(
  signals: IntentSignal[],
  context: CompanyContext,
): Promise<ScoredIntent[]> {
  if (signals.length === 0) return []

  if (!isLlmConfigured()) {
    return signals.map((signal) => ({
      ...signal,
      relevanceScore: 5,
      whyRelevant: "LLM API key missing — manual review.",
      suggestedResponse: "",
      responsePlatform: defaultResponsePlatform(signal.platform),
      urgency: "monitor" as const,
    }))
  }

  const out: ScoredIntent[] = []
  const chunkSize = 6

  for (let i = 0; i < signals.length; i += chunkSize) {
    const chunk = signals.slice(i, i + chunkSize)

    const prompt = `You are a product strategy and customer research analyst monitoring Reddit conversations for people who may need a product like ours.

OUR COMPANY:
${context.promptBlock}

INTENT SIGNALS (JSON array of public posts/comments):
${JSON.stringify(
      chunk.map((signal) => ({
        url: signal.url,
        platform: signal.platform,
        type: signal.type,
        title: signal.title,
        body: signal.body,
        author: signal.author,
        subreddit: signal.subreddit,
        matchedKeywords: signal.matchedKeywords,
      })),
      null,
      2,
    )}

For EACH signal, return one object in a JSON array with this exact shape:
{
  "url": "same as input",
  "relevanceScore": <1-10 integer>,
  "whyRelevant": "1-3 sentences: what frustration or request is in the thread, why it matters for our ICP, and what it suggests about demand or product gaps",
  "suggestedResponse": "Draft a helpful Reddit reply that does NOT sell. Lead with genuine insight, answer their question or validate pain, and only mention our company naturally if there is a clear opening. No pitch, no CTA, no 'DM me'.",
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
      const { text } = await generateText({
        model: qwenModel(),
        maxOutputTokens: 6000,
        messages: [{ role: "user", content: appendWritingRules(prompt) }],
      })
      if (!text) throw new Error("empty response")

      const match = text.match(/\[[\s\S]*\]/)
      const parsed = match ? (JSON.parse(match[0]) as unknown) : []
      const rows = Array.isArray(parsed) ? parsed : []

      const byUrl = new Map<string, Record<string, unknown>>()
      for (const row of rows) {
        if (row && typeof row === "object" && "url" in row) {
          const url = String((row as { url: string }).url).trim()
          byUrl.set(url.split("?")[0], row as Record<string, unknown>)
        }
      }

      type RowShape = {
        relevanceScore?: number
        whyRelevant?: string
        suggestedResponse?: string
        responsePlatform?: string
        urgency?: string
      }

      for (let index = 0; index < chunk.length; index++) {
        const signal = chunk[index]
        const key = signal.url.split("?")[0]
        const fromUrl = byUrl.get(key) as RowShape | undefined
        const fromIndex = rows[index] as RowShape | undefined
        const row = fromUrl ?? fromIndex

        const score =
          typeof row?.relevanceScore === "number"
            ? Math.min(10, Math.max(1, Math.round(row.relevanceScore)))
            : 5

        out.push({
          ...signal,
          relevanceScore: score,
          whyRelevant: typeof row?.whyRelevant === "string" ? row.whyRelevant : "",
          suggestedResponse: typeof row?.suggestedResponse === "string" ? row.suggestedResponse : "",
          responsePlatform: normalizePlatform(row?.responsePlatform, signal.platform),
          urgency: normalizeUrgency(row?.urgency),
        })
      }
    } catch (error) {
      console.error("[intent-scoring] batch failed:", error)
      for (const signal of chunk) {
        out.push({
          ...signal,
          relevanceScore: 5,
          whyRelevant: "Scoring failed - review manually.",
          suggestedResponse: "",
          responsePlatform: defaultResponsePlatform(signal.platform),
          urgency: "monitor",
        })
      }
    }
  }

  return out
}

function normalizePlatform(raw: string | undefined, platform: IntentSignal["platform"]): ResponsePlatform {
  const value = (raw ?? "").toLowerCase()
  if (value.includes("hn") || value === "hn_reply") return "hn_reply"
  if (value.includes("reddit")) return "reddit_comment"
  if (value.includes("linkedin")) return "linkedin_dm"
  if (value.includes("x_") || value.includes("twitter")) return "x_reply"
  if (value.includes("email")) return "direct_email"
  return defaultResponsePlatform(platform)
}

function normalizeUrgency(raw: string | undefined): UrgencyLevel {
  const value = (raw ?? "").toLowerCase()
  if (value.includes("now")) return "respond_now"
  if (value.includes("week")) return "this_week"
  return "monitor"
}
