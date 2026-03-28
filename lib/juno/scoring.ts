import Anthropic from "@anthropic-ai/sdk"
import { appendWritingRules, mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import type { CompanyContext } from "@/lib/company-context"
import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import type { CompetitorEvent, RawItem, ScoredItem } from "./types"

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
      strategicImplication: "—",
      suggestedAction: "No immediate action — file as context",
      connectionToRoadmap: null,
      competitorEvent: null,
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

  const prompt = `You are a strategic intelligence analyst for a startup founder.
You don't just report news — you connect every piece of information to the
founder's specific situation, strategy, and decisions.

You have DEEP knowledge of this company from the context below. Use it.

${context.promptBlock}

ITEMS TO ANALYSE:
${JSON.stringify(itemSummaries, null, 2)}

Return ONLY a JSON array. Each object MUST include \`index\` (number, matching the item's index in ITEMS TO ANALYSE) plus:

1. relevanceScore (0-10): How much does this SPECIFICALLY affect this founder?
   - 9-10: Directly about a named competitor, threatens/validates our thesis, or changes our market
   - 7-8: Affects our ICP, our technology stack, or our fundraising narrative
   - 5-6: Relevant to our broader industry, worth knowing
   - 3-4: Tangentially interesting, most founders would skip
   - 0-2: Not relevant to this specific company

2. urgency: "breaking" | "today" | "this_week"

3. category: "competitor" | "funding" | "regulation" | "research" | "tool" | "opportunity"

4. whyItMatters: 2-3 sentences explaining why THIS founder should care.
   RULES for whyItMatters:
   - MUST reference something specific from the company context (their product,
     their ICP, their competitors, their thesis, their roadmap, their risks)
   - NEVER generic. "This could affect AI companies" is useless.
     "This directly impacts your Research Agent's GAAP citation system" is useful.
   - Connect to the founder's CURRENT priorities if possible (from their 90-day
     priorities or roadmap in the context)
   - If the item relates to a competitor, say the competitor's name and what
     this means competitively
   - If the item relates to their ICP, explain HOW their customers are affected

5. strategicImplication: One sentence on the bigger picture.
   What does this mean for the founder's strategy, positioning, or narrative?
   Think like a board advisor, not a news aggregator.
   Examples:
   - "This validates your bet on specialized audit agents over general-purpose AI"
   - "Your competitor now has 3x your runway — speed to market becomes critical"
   - "This regulation creates a moat for compliant solutions like yours"
   - "This technology could cut your Research Agent's inference costs by 40%"

6. suggestedAction: One specific, concrete thing the founder could do.
   NOT "keep monitoring" or "stay informed" — those are non-actions.
   GOOD actions:
   - "Reference this in your next investor pitch as market validation"
   - "Check if this API could replace your current GAAP lookup pipeline"
   - "Reach out to [company] — they just signaled they need exactly what you build"
   - "Update your competitive positioning slide — this changes the landscape"
   - "Write a LinkedIn post with your take — you have unique credibility here"
   - "Add this to your roadmap discussion — could accelerate feature X"
   - "Flag this for your next design partner conversation"
   If there's genuinely no action, say "No immediate action — file as context"

7. connectionToRoadmap: Optional string or null. If the item connects to something in the
   founder's roadmap, priorities, or known risks, reference it explicitly.
   Example: "Connects to your Q1 priority of shipping the Monitoring Agent —
   this paper's approach to real-time validation could inform your architecture"

8. competitorEvent: If this item is about a known competitor or a company in the same space,
   return an object. Otherwise return null.
   Shape when relevant:
   {
     "companyName": "Lindy.ai",
     "eventType": "funding",
     "fundingAmount": "$50M",
     "fundingRound": "Series B",
     "leadInvestor": "Accel",
     "threatLevel": "high",
     "suggestedResponse": "Update competitive positioning. They now have 3x your runway.",
     "competitorUrl": null
   }
   eventType must be one of: funding, product_launch, hire, partnership, pivot, press,
   acquisition, customer_win, pricing_change (use snake_case as listed).
   For non-funding events, omit funding fields or set them null.
   Return null if this is not a competitor or market-company event worth tracking.

CRITICAL RULES:
- Be ruthlessly specific. Reference the company by name, the product by name,
  the competitors by name, the ICP by description.
- If you can't explain why a specific founder should care about a specific item
  in a way that references their specific situation, score it below 4.
- The strategicImplication should make the founder think "I hadn't connected those
  dots" — that's the value of having an intelligence analyst.
- suggestedAction should be something they could do THIS WEEK, not someday.
- Don't inflate scores. Most items should be 3-5. Reserve 7+ for genuinely
  important signals. A 10 should make the founder stop what they're doing.`

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 12000,
      messages: [{ role: "user", content: appendWritingRules(prompt) }],
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
      strategicImplication?: string
      suggestedAction?: string
      connectionToRoadmap?: string | null
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
        const roadmap =
          s.connectionToRoadmap === undefined || s.connectionToRoadmap === ""
            ? null
            : String(s.connectionToRoadmap)
        return {
          ...original,
          relevanceScore: typeof s.relevanceScore === "number" ? s.relevanceScore : 5,
          urgency,
          category,
          whyItMatters: s.whyItMatters || "—",
          strategicImplication: s.strategicImplication?.trim() || "—",
          suggestedAction: s.suggestedAction?.trim() || "No immediate action — file as context",
          connectionToRoadmap: roadmap,
          competitorEvent: normalizeCompetitorEvent(s.competitorEvent),
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
      strategicImplication: "—",
      suggestedAction: "No immediate action — file as context",
      connectionToRoadmap: null,
      competitorEvent: null,
    }))
  }
}

function normalizeCompetitorEvent(raw: unknown): CompetitorEvent | null {
  if (raw == null || raw === false) return null
  if (typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const companyName = typeof o.companyName === "string" ? o.companyName.trim() : ""
  const eventType = typeof o.eventType === "string" ? o.eventType.trim() : ""
  if (!companyName || !eventType) return null
  return {
    companyName,
    eventType,
    fundingAmount: typeof o.fundingAmount === "string" ? o.fundingAmount : null,
    fundingRound: typeof o.fundingRound === "string" ? o.fundingRound : null,
    leadInvestor: typeof o.leadInvestor === "string" ? o.leadInvestor : null,
    threatLevel: typeof o.threatLevel === "string" ? o.threatLevel : null,
    suggestedResponse: typeof o.suggestedResponse === "string" ? o.suggestedResponse : null,
    competitorUrl: typeof o.competitorUrl === "string" ? o.competitorUrl : null,
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
          `- **${t.title}** (${t.source}) — **${t.relevanceScore}/10** [${t.category}] — ${t.whyItMatters} — _${t.strategicImplication}_ — Action: ${t.suggestedAction}`,
      ),
    ].join("\n")
  }

  const top = [...scored].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 12)

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxOutputTokens: 2048,
    system: mergeSystemWithWritingRules(`Write a tight executive daily brief in Markdown: sections Top signals, Why it matters, Strategic implications, Suggested actions (bullets).
Ground everything in the company context when possible. Use each item's relevance score (0-10), category, urgency, whyItMatters, strategicImplication, suggestedAction, and connectionToRoadmap. Be direct.`),
    prompt: `Company context:\n${companyContext.slice(0, 12000)}\n\nScored items (higher relevance = more important):\n${JSON.stringify(
      top.map((t) => ({
        relevanceScore: t.relevanceScore,
        urgency: t.urgency,
        category: t.category,
        whyItMatters: t.whyItMatters,
        strategicImplication: t.strategicImplication,
        suggestedAction: t.suggestedAction,
        connectionToRoadmap: t.connectionToRoadmap,
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
