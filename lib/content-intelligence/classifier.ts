import { generateText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import type { ClassifiedItem, ContentBriefing, ContentPillar, ContentUrgency, RawItem } from "@/lib/content-intelligence/types"

function heuristicPillar(item: RawItem): ContentPillar {
  const t = `${item.title} ${item.snippet}`.toLowerCase()
  if (/(safety|policy|trust|governance|risk|privacy)/.test(t)) return "safety_trust"
  if (/(b2b|cfo|outreach|cold email|demo|pipeline|quota|rev(enue|ops)|SDR|AE|account exec|discovery call|closing deal|sales cycle|ICP|ideal customer)/.test(t)) return "workplace"
  if (/(work|hiring|job|consulting|legal|accounting|enterprise|productivity)/.test(t)) return "workplace"
  if (/(how to|tutorial|prompt|tool|workflow|tips|hack)/.test(t)) return "hacks"
  if (/(research|paper|index|study|benchmark|report)/.test(t)) return "deep_dive"
  return "breaking"
}

function heuristicUrgency(item: RawItem): ContentUrgency {
  const hours = (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60)
  if (hours <= 24) return "breaking"
  if (hours <= 48) return "today"
  if (hours <= 168) return "this_week"
  return "evergreen"
}

function heuristicScore(item: RawItem): number {
  const t = `${item.title} ${item.snippet}`
  let score = 5
  if (/a16z speedrun/i.test(item.source)) score += 1
  if (/\d/.test(t)) score += 1
  if (/(openai|anthropic|google|meta|microsoft|amazon|nvidia|stanford|mit)/i.test(t)) score += 2
  if (/(launch|release|index|lawsuit|ban|leak|layoff|funding|acquisition)/i.test(t)) score += 2
  // Boost B2B sales discussions — these are high-signal for outreach strategy
  if (/r\/(sales|b2bsales|CFO|saas)/i.test(item.source)) score += 1
  if (/(CFO|chief financial|VP sales|sales director|enterprise.*sales|loath|hate|email.*demo|demo.*email|cold.*email|spam|reply rate)/i.test(t)) score += 2
  if (/(what.*(work|working)|how.*close|best.*outreach|mistake|lesson|playbook|script|cadence)/i.test(t)) score += 1
  return Math.max(1, Math.min(10, score))
}

function isTwitterSource(item: RawItem): boolean {
  return /twitter|x \(twitter\)/i.test(item.source)
}

function hasCollabSignal(item: Pick<RawItem, "title" | "snippet">): boolean {
  const t = `${item.title} ${item.snippet}`.toLowerCase()
  return /(sponsor|sponsorship|brand deal|partnership|collab|collaboration|creator program|ambassador|ugc|affiliate|paid post|looking for.*creator|looking for.*blogger|influencer)/.test(
    t,
  )
}

function buildFallback(items: RawItem[]): ClassifiedItem[] {
  return items.map((item) => {
    const pillar = heuristicPillar(item)
    const urgency = heuristicUrgency(item)
    const contentScore = heuristicScore(item)
    const social = isTwitterSource(item)
    const collab = hasCollabSignal(item)
    return {
      ...item,
      pillar,
      urgency,
      contentScore,
      hook: collab
        ? `Collab lead: ${item.snippet.slice(0, 120)}${item.snippet.length > 120 ? "..." : ""}`
        : social
          ? `Tweet-sized signal: ${item.snippet.slice(0, 100)}${item.snippet.length > 100 ? "..." : ""}`
        : `${item.source} surfaced a story worth a founder take. Lead with the claim, not the headline.`,
      whyItMatters: collab
        ? "This is a direct outreach signal. Reply fast with your niche, audience proof, and one concrete pitch angle."
        : social
          ? "Short posts still carry stance, launches, and fights worth reacting to if you film AI takes."
        : "Useful if your audience tracks how AI shows up in real work, not slide decks.",
      connectedTopics: collab ? ["collab_opportunity"] : [],
      namedEntities: { people: [], companies: [], numbers: [] },
    }
  })
}

function extractJsonArray(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("[")
    const end = cleaned.lastIndexOf("]")
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function sanitizeParsed(input: unknown, originals: RawItem[]): ClassifiedItem[] {
  if (!Array.isArray(input)) return []
  return originals.map((base, idx) => {
    const row = input[idx]
    if (!row || typeof row !== "object") {
      return buildFallback([base])[0]!
    }
    const r = row as Record<string, unknown>
    const score = typeof r.contentScore === "number" ? r.contentScore : heuristicScore(base)
    const hook =
      typeof r.hook === "string" && r.hook.trim().length > 0
        ? r.hook.slice(0, 220)
        : buildFallback([base])[0]!.hook
    return {
      ...base,
      pillar: (r.pillar as ContentPillar) || heuristicPillar(base),
      urgency: (r.urgency as ContentUrgency) || heuristicUrgency(base),
      contentScore: Math.max(1, Math.min(10, Math.round(score))),
      hook,
      keyQuote: typeof r.keyQuote === "string" ? r.keyQuote.slice(0, 260) : undefined,
      whyItMatters:
        typeof r.whyItMatters === "string" && r.whyItMatters.trim().length > 0
          ? r.whyItMatters.slice(0, 400)
          : buildFallback([base])[0]!.whyItMatters,
      connectedTopics: Array.isArray(r.connectedTopics) ? r.connectedTopics.filter((v) => typeof v === "string") : [],
      namedEntities: {
        people: Array.isArray((r.namedEntities as Record<string, unknown>)?.people)
          ? ((r.namedEntities as Record<string, unknown>).people as unknown[]).filter((v) => typeof v === "string")
          : [],
        companies: Array.isArray((r.namedEntities as Record<string, unknown>)?.companies)
          ? ((r.namedEntities as Record<string, unknown>).companies as unknown[]).filter((v) => typeof v === "string")
          : [],
        numbers: Array.isArray((r.namedEntities as Record<string, unknown>)?.numbers)
          ? ((r.namedEntities as Record<string, unknown>).numbers as unknown[]).filter((v) => typeof v === "string")
          : [],
      },
    } satisfies ClassifiedItem
  })
}

const CLASSIFIER_SYSTEM = `You classify items for a B2B SaaS founder doing sales, GTM strategy, and content creation about AI and workplace tech.

Output: a JSON array only. Same length and order as the input list. Each object must have:
pillar (breaking|workplace|hacks|deep_dive|safety_trust),
urgency (breaking|today|this_week|evergreen),
contentScore (1-10 integer),
hook (string, under 200 chars),
keyQuote (string or omit),
whyItMatters (string, under 400 chars),
connectedTopics (string array),
namedEntities (object with people, companies, numbers arrays of strings).

Analysis rules:
- hook: Say what is actually happening (claim, launch, fight, data point). Do not write "just moved this story", "here is the angle most people miss", or filler about the feed itself.
- For X/Twitter or social-native items (source mentions Twitter or X): the snippet is usually the post. Name the underlying move or stance. One analyst-style line.
- For Reddit B2B/sales items (source starts with r/): extract the core insight or complaint. Name the buyer persona (CFO, VP Sales, AE) and what they said. This is outreach intelligence — the founder needs to know what buyers think and say.
- whyItMatters: Name who should care (founders, buyers, builders, policy) and why timing matters. For B2B sales items, explain how this changes or validates outreach strategy.
- If an item reveals what buyers hate, fear, or find valuable in the sales process, include "buyer_insight" in connectedTopics. If it reveals what outreach tactics work or fail, include "outreach_signal".
- If it contains CFO or finance-team perspectives on vendor selection, include "cfo_signal" in connectedTopics.
- If an item looks like a creator/sponsorship/collaboration lead, include "collab_opportunity" in connectedTopics.
- Score higher when the item has names, numbers, or a clear news hook. Score B2B Reddit discussions higher when they reveal candid buyer opinions or counter-intuitive sales findings.`

export async function classifyAndScore(items: RawItem[], angle?: string): Promise<ClassifiedItem[]> {
  if (!isLlmConfigured() || items.length === 0) return buildFallback(items)

  const userPayload = `Audience: smart professionals who are not all engineers. Optional angle from the founder: ${angle ?? "none"}

For each item below, produce one array entry in the same order.

${items
  .map(
    (item, i) =>
      `[${i}] title: ${item.title}\nsource: ${item.source}\nurl: ${item.url}\nsnippet: ${item.snippet}`,
  )
  .join("\n\n")}`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(CLASSIFIER_SYSTEM),
      prompt: userPayload,
      maxTokens: 6000,
      temperature: 0.25,
    })

    const parsed = extractJsonArray(text)
    if (!parsed) return buildFallback(items)
    const rows = sanitizeParsed(parsed, items)
    return rows.length > 0 ? rows : buildFallback(items)
  } catch (e) {
    console.warn("[content-intelligence] OpenRouter classify failed:", e)
    return buildFallback(items)
  }
}

export function buildBriefing(items: ClassifiedItem[], angle?: string): ContentBriefing {
  const breaking = items.filter((i) => i.urgency === "breaking").sort((a, b) => b.contentScore - a.contentScore)
  const readyToFilm = items.filter((i) => i.contentScore >= 7 && i.urgency !== "breaking").sort((a, b) => b.contentScore - a.contentScore)
  const watchList = items.filter((i) => i.contentScore >= 4 && i.contentScore < 7).sort((a, b) => b.contentScore - a.contentScore)
  const deepDiveSeeds = items.filter((i) => i.pillar === "deep_dive").sort((a, b) => b.contentScore - a.contentScore)
  const collabCount = items.filter((i) => i.connectedTopics.some((t) => t.toLowerCase() === "collab_opportunity")).length
  const top = [...breaking, ...readyToFilm].sort((a, b) => b.contentScore - a.contentScore)[0]
  return {
    id: `briefing-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    angle,
    summary: top
      ? `${top.source} and peers are driving this cycle. Workplace impact and model releases are the strongest short-form angles right now.${collabCount > 0 ? ` ${collabCount} collaboration lead${collabCount === 1 ? "" : "s"} detected.` : ""}`
      : "No high-signal stories found in this cycle.",
    topHook: top?.hook || "Start with one story that has a named company and a hard number.",
    connections: items.slice(0, 3).map((i) => `${i.source}: ${i.title}`),
    sections: { breaking, readyToFilm, watchList, deepDiveSeeds },
  }
}
