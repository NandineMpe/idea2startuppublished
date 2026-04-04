import type { CompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"

export type RedditReconSignal = {
  title: string
  body: string | null
  subreddit: string | null
  matched_keywords: string[] | null
  why_relevant: string | null
  url: string
  discovered_at: string
  relevance_score: number | null
  signal_type: string
}

export type RedditReconSummary = {
  overview: string
  themes: Array<{ title: string; detail: string }>
  simulatedConversations: Array<{ speaker: string; message: string; implication: string }>
  opportunities: string[]
  gaps: string[]
  nextMoves: string[]
}

function normalizeLines(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit)
}

function truncate(text: string, max = 180): string {
  const compact = text.replace(/\s+/g, " ").trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max - 1).trimEnd()}…`
}

function fallbackThemeTitle(signal: RedditReconSignal): string {
  const keywords = (signal.matched_keywords ?? []).filter(Boolean)
  if (keywords.length > 0) {
    return `Repeated pain around ${keywords.slice(0, 2).join(" and ")}`
  }

  if (signal.signal_type === "buying") return "Active search for a better tool"
  if (signal.signal_type === "competitor") return "Competitor comparison or replacement motion"
  return "Operational frustration surfacing in the open"
}

function fallbackConversationMessage(signal: RedditReconSignal): string {
  const source = truncate(signal.body?.trim() || signal.title)
  if (!source) return "I am frustrated with the current workflow and looking for a better approach."
  const normalized = source.replace(/^["'`]+|["'`]+$/g, "").trim()
  if (/^(i|we)\b/i.test(normalized)) return normalized
  return `I am dealing with ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`
}

function buildOpportunity(signal: RedditReconSignal, context: CompanyContext): string {
  const company = context.profile.name.trim() || "our company"
  const matched = (signal.matched_keywords ?? []).filter(Boolean)
  const keywordLabel = matched.length > 0 ? matched.slice(0, 2).join(" / ") : "the repeated pain in this thread"

  if (signal.signal_type === "buying") {
    return `Use ${keywordLabel} as a direct customer-discovery wedge for ${company}; this thread already sounds like someone evaluating options.`
  }

  if (signal.signal_type === "competitor") {
    return `Position ${company} against the competitor language showing up around ${keywordLabel}, and capture the replacement criteria in the vault.`
  }

  return `Treat ${keywordLabel} as product-learning input and validate whether ${company} should solve it more explicitly.`
}

function buildFallbackGaps(context: CompanyContext, signals: RedditReconSignal[]): string[] {
  const gaps: string[] = []
  const contextKeywords = new Set(context.extracted.keywords.map((value) => value.toLowerCase()))
  const unmatched = new Map<string, number>()

  for (const signal of signals) {
    for (const keyword of signal.matched_keywords ?? []) {
      const lower = keyword.toLowerCase()
      if (!contextKeywords.has(lower)) {
        unmatched.set(keyword, (unmatched.get(keyword) ?? 0) + 1)
      }
    }
  }

  const risingKeywords = [...unmatched.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([keyword]) => keyword)

  if (risingKeywords.length > 0) {
    gaps.push(`Reddit keeps surfacing ${risingKeywords.join(", ")} more often than your saved context does today.`)
  }

  if (!context.profile.vault_context_cache.trim()) {
    gaps.push("Your GitHub-backed vault is not yet contributing cached context, so product reconciliation is thinner than it should be.")
  }

  if (!context.profile.knowledge_base_md.trim()) {
    gaps.push("There is no saved knowledge base markdown yet, which makes it harder to compare recurring Reddit pain to your current product stance.")
  }

  if (context.assets.length === 0) {
    gaps.push("No supporting product docs or assets are saved yet, so Luckmaxxing has less concrete material to compare against live Reddit demand.")
  }

  if (gaps.length === 0) {
    gaps.push("The biggest remaining gap is converting recurring Reddit pain into explicit roadmap language inside your context and vault.")
  }

  return gaps.slice(0, 5)
}

function buildFallbackSummary(context: CompanyContext, signals: RedditReconSignal[]): RedditReconSummary {
  const ranked = [...signals].sort((a, b) => (b.relevance_score ?? 0) - (a.relevance_score ?? 0))
  const topSignals = ranked.slice(0, 4)
  const company = context.profile.name.trim() || "your company"

  if (topSignals.length === 0) {
    return {
      overview: `No Reddit conversations have been saved yet for ${company}. Run the Reddit scan and Luckmaxxing will start turning live posts into product opportunities and gaps.`,
      themes: [],
      simulatedConversations: [],
      opportunities: [
        "Run the Reddit scan now so Juno can collect real customer-language before you make product decisions.",
      ],
      gaps: buildFallbackGaps(context, []),
      nextMoves: [
        "Add a few product, competitor, and pain phrases to the scan priorities above.",
        "Keep the vault synced so new Reddit pain can be compared against your actual product context.",
      ],
    }
  }

  return {
    overview: `Recent Reddit conversations suggest ${company} is closest to active customer pain around ${topSignals
      .flatMap((signal) => signal.matched_keywords ?? [])
      .slice(0, 3)
      .join(", ") || "workflow frustration and tool evaluation"}. Use these threads as voice-of-customer input before deciding what to build next.`,
    themes: topSignals.slice(0, 3).map((signal) => ({
      title: fallbackThemeTitle(signal),
      detail: signal.why_relevant?.trim() || truncate(signal.body?.trim() || signal.title, 220),
    })),
    simulatedConversations: topSignals.slice(0, 3).map((signal) => ({
      speaker: signal.subreddit ? `Buyer voice from r/${signal.subreddit}` : "Potential customer",
      message: fallbackConversationMessage(signal),
      implication:
        signal.why_relevant?.trim() || buildOpportunity(signal, context),
    })),
    opportunities: topSignals.map((signal) => buildOpportunity(signal, context)).slice(0, 5),
    gaps: buildFallbackGaps(context, topSignals),
    nextMoves: [
      "Review the strongest Reddit threads weekly and turn repeated complaints into explicit product hypotheses.",
      "Update your saved context when a new buyer phrase or workflow keeps appearing in Reddit conversations.",
      "Use the simulated conversations below to test whether your current messaging sounds like it matches the real pain.",
    ],
  }
}

export async function summarizeRedditRecon(
  context: CompanyContext,
  signals: RedditReconSignal[],
): Promise<RedditReconSummary> {
  if (signals.length === 0 || !isLlmConfigured()) {
    return buildFallbackSummary(context, signals)
  }

  const sample = signals.slice(0, 12).map((signal) => ({
    title: signal.title,
    body: signal.body,
    subreddit: signal.subreddit,
    signalType: signal.signal_type,
    whyRelevant: signal.why_relevant,
    relevanceScore: signal.relevance_score,
    matchedKeywords: signal.matched_keywords,
    url: signal.url,
  }))

  const prompt = `You are a product strategy analyst turning Reddit conversations into product-learning output.

COMPANY CONTEXT:
${context.promptBlock}

RECENT REDDIT THREADS:
${JSON.stringify(sample, null, 2)}

Analyze these threads as voice-of-customer research. Reconcile what people are saying with the company context, knowledge base, saved assets, and vault context.

Return one JSON object with this exact shape:
{
  "overview": "2-4 sentences summarizing the strongest pattern across the threads",
  "themes": [
    { "title": "short theme", "detail": "1-2 sentence explanation of the repeated frustration or request" }
  ],
  "simulatedConversations": [
    {
      "speaker": "short persona label",
      "message": "a paraphrased 1-3 sentence customer-style statement synthesizing several threads",
      "implication": "what this suggests for product validation"
    }
  ],
  "opportunities": ["specific opportunity statement"],
  "gaps": ["specific gap between demand and our current context/product story"],
  "nextMoves": ["specific next step"]
}

Rules:
- Focus on what people want, what frustrates them, and what this means for what we should build or clarify.
- Paraphrase customer language; do not quote long passages.
- Opportunities should connect directly to the company context.
- Gaps should call out where the current product scope, positioning, or saved context seems thin or mismatched.
- Limit themes to 4, simulatedConversations to 3, opportunities to 5, gaps to 5, nextMoves to 4.
- Return only valid JSON.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 2200,
      messages: [{ role: "user", content: prompt }],
    })
    if (!text) return buildFallbackSummary(context, signals)
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? (JSON.parse(match[0]) as Record<string, unknown>) : null
    if (!parsed) {
      return buildFallbackSummary(context, signals)
    }

    const overview =
      typeof parsed.overview === "string" && parsed.overview.trim()
        ? parsed.overview.trim()
        : buildFallbackSummary(context, signals).overview

    const themes = Array.isArray(parsed.themes)
      ? parsed.themes
          .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
          .map((value) => ({
            title: typeof value.title === "string" ? value.title.trim() : "",
            detail: typeof value.detail === "string" ? value.detail.trim() : "",
          }))
          .filter((value) => value.title && value.detail)
          .slice(0, 4)
      : []

    const simulatedConversations = Array.isArray(parsed.simulatedConversations)
      ? parsed.simulatedConversations
          .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
          .map((value) => ({
            speaker: typeof value.speaker === "string" ? value.speaker.trim() : "",
            message: typeof value.message === "string" ? value.message.trim() : "",
            implication: typeof value.implication === "string" ? value.implication.trim() : "",
          }))
          .filter((value) => value.speaker && value.message && value.implication)
          .slice(0, 3)
      : []

    const opportunities = normalizeLines(parsed.opportunities, 5)
    const gaps = normalizeLines(parsed.gaps, 5)
    const nextMoves = normalizeLines(parsed.nextMoves, 4)
    const fallback = buildFallbackSummary(context, signals)

    return {
      overview,
      themes: themes.length > 0 ? themes : fallback.themes,
      simulatedConversations:
        simulatedConversations.length > 0 ? simulatedConversations : fallback.simulatedConversations,
      opportunities: opportunities.length > 0 ? opportunities : fallback.opportunities,
      gaps: gaps.length > 0 ? gaps : fallback.gaps,
      nextMoves: nextMoves.length > 0 ? nextMoves : fallback.nextMoves,
    }
  } catch (error) {
    console.error("[reddit-recon] summary failed:", error)
    return buildFallbackSummary(context, signals)
  }
}
