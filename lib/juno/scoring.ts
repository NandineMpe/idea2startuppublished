import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import type { ScrapedItem, ScoredItem } from "./types"

/**
 * Score scraped items against company context (Claude).
 */
export async function scoreItemsAgainstProfile(
  companyContext: string,
  items: ScrapedItem[],
): Promise<ScoredItem[]> {
  if (!process.env.ANTHROPIC_API_KEY || items.length === 0) {
    return items.map((i) => ({ ...i, score: 50, reason: "Unscored (no API key or empty)" }))
  }

  const payload = items.map((i) => ({
    id: i.id,
    source: i.source,
    title: i.title,
    summary: i.summary.slice(0, 800),
    url: i.url,
  }))

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxTokens: 4096,
    system: `You are a research analyst for a startup. Score each item 0-100 for how USEFUL and RELEVANT it is to this company's strategy and market, given the company profile below.
Return ONLY valid JSON: { "scores": [ { "id": string, "score": number, "reason": string } ] }
Company context:
${companyContext || "(no profile — score on general startup relevance)"}`,
    prompt: `Items:\n${JSON.stringify(payload, null, 2)}`,
  })

  const parsed = parseScoresJson(text)
  const byId = new Map(parsed.map((s) => [s.id, s]))
  return items.map((i) => {
    const s = byId.get(i.id)
    return {
      ...i,
      score: typeof s?.score === "number" ? Math.min(100, Math.max(0, s.score)) : 40,
      reason: s?.reason ?? "Could not parse score",
    }
  })
}

function parseScoresJson(text: string): { id: string; score: number; reason: string }[] {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return []
    const obj = JSON.parse(jsonMatch[0]) as { scores?: { id: string; score: number; reason: string }[] }
    return obj.scores ?? []
  } catch {
    return []
  }
}

/**
 * Produce a structured daily brief markdown from scored items.
 */
export async function generateBriefMarkdown(companyContext: string, scored: ScoredItem[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 8)
    return ["## Daily brief (offline)", "", ...top.map((t) => `- **${t.title}** (${t.source}) — ${t.score}/100`)].join("\n")
  }

  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 12)

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxTokens: 2048,
    system: `Write a tight executive daily brief in Markdown: sections Top signals, Why it matters, Suggested actions (bullets). 
Ground everything in the company context when possible. Be direct.`,
    prompt: `Company context:\n${companyContext.slice(0, 12000)}\n\nScored items (higher = more relevant):\n${JSON.stringify(
      top.map((t) => ({
        score: t.score,
        source: t.source,
        title: t.title,
        reason: t.reason,
        url: t.url,
      })),
      null,
      2,
    )}`,
  })

  return text
}
