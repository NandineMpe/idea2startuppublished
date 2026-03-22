import Anthropic from "@anthropic-ai/sdk"
import type { CompanyContext } from "@/lib/company-context"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import type { RawItem, ScoredItem } from "./types"

export type { RawItem, ScoredItem } from "./types"

const client = new Anthropic()

const VALID_URGENCY = new Set<ScoredItem["urgency"]>(["breaking", "today", "this_week"])
const VALID_CATEGORY = new Set<ScoredItem["category"]>([
  "competitor",
  "funding",
  "regulation",
  "research",
  "tool",
  "opportunity",
])

/**
 * Score items against the FULL company context.
 * This is not keyword matching — Claude reads the founder's pitch deck,
 * thesis, ICP, competitive landscape, and then judges relevance.
 */
export async function scoreItems(items: RawItem[], context: CompanyContext): Promise<ScoredItem[]> {
  if (items.length === 0) return []

  if (!process.env.ANTHROPIC_API_KEY) {
    return items.map((item) => ({
      ...item,
      relevanceScore: 5,
      urgency: "today" as const,
      category: "opportunity" as const,
      whyItMatters: "Unscored — set ANTHROPIC_API_KEY",
    }))
  }

  const chunks = chunkArray(items, 15)
  const allScored: ScoredItem[] = []

  for (const chunk of chunks) {
    const scored = await scoreChunk(chunk, context)
    allScored.push(...scored)
  }

  return allScored
    .filter((item) => item.relevanceScore >= 4)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

async function scoreChunk(items: RawItem[], context: CompanyContext): Promise<ScoredItem[]> {
  const itemSummaries = items.map((item, i) => ({
    index: i,
    title: item.title,
    description: item.description.substring(0, 300),
    source: item.source,
  }))

  const prompt = `You are an intelligence analyst for a startup founder. You have deep knowledge of their company from the context below. Use this knowledge to score each news item for relevance.

${context.promptBlock}

ITEMS TO SCORE:
${JSON.stringify(itemSummaries, null, 2)}

SCORING RULES:
- 9-10: Directly about a named competitor, our exact vertical, or breaks something we depend on
- 7-8: Highly relevant to our market, ICP, or technology stack
- 5-6: Tangentially relevant, good to know
- 3-4: Mildly interesting, most founders would skip
- 0-2: Not relevant to this specific company

For each item return:
- index: number
- relevanceScore: 0-10
- urgency: "breaking" (act today) | "today" (know today) | "this_week" (background)
- category: "competitor" | "funding" | "regulation" | "research" | "tool" | "opportunity"
- whyItMatters: One sentence explaining why THIS founder should care, referencing specifics from their company context (their product, their competitors, their market). Never generic.

Return ONLY a JSON array.`

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { text: string }).text)
      .join("")

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    const scored: Array<{
      index: number
      relevanceScore: number
      urgency: string
      category: string
      whyItMatters: string
    }> = JSON.parse(jsonMatch[0])

    return scored
      .map((s) => {
        const original = items[s.index]
        if (!original) return null
        const urgency = VALID_URGENCY.has(s.urgency as ScoredItem["urgency"])
          ? (s.urgency as ScoredItem["urgency"])
          : "today"
        const category = VALID_CATEGORY.has(s.category as ScoredItem["category"])
          ? (s.category as ScoredItem["category"])
          : "opportunity"
        return {
          ...original,
          relevanceScore: typeof s.relevanceScore === "number" ? s.relevanceScore : 5,
          urgency,
          category,
          whyItMatters: s.whyItMatters || "—",
        }
      })
      .filter((s): s is ScoredItem => s !== null)
  } catch (e) {
    console.error("Scoring failed:", e)
    return items.map((item) => ({
      ...item,
      relevanceScore: 5,
      urgency: "today" as const,
      category: "opportunity" as const,
      whyItMatters: "Scoring failed — review manually.",
    }))
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

/**
 * Produce a structured daily brief markdown from scored items.
 */
export async function generateBriefMarkdown(companyContext: string, scored: ScoredItem[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const top = [...scored].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 8)
    return [
      "## Daily brief (offline)",
      "",
      ...top.map(
        (t) =>
          `- **${t.title}** (${t.source}) — **${t.relevanceScore}/10** [${t.category}] — ${t.whyItMatters}`,
      ),
    ].join("\n")
  }

  const top = [...scored].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 12)

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxOutputTokens: 2048,
    system: `Write a tight executive daily brief in Markdown: sections Top signals, Why it matters, Suggested actions (bullets).
Ground everything in the company context when possible. Use each item's relevance score (0-10), category, urgency, and whyItMatters. Be direct.`,
    prompt: `Company context:\n${companyContext.slice(0, 12000)}\n\nScored items (higher relevance = more important):\n${JSON.stringify(
      top.map((t) => ({
        relevanceScore: t.relevanceScore,
        urgency: t.urgency,
        category: t.category,
        whyItMatters: t.whyItMatters,
        source: t.source,
        title: t.title,
        url: t.url,
      })),
      null,
      2,
    )}`,
  })

  return text
}
