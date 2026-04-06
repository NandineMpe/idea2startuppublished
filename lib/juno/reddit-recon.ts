import type { CompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"

export type RedditReconSignal = {
  id?: string
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

export type BehavioralTheme = {
  title: string
  detail: string
}

export type RedditBehavioralSummary = {
  overview: string
  sentiment: string
  themes: BehavioralTheme[]
  pushOfPresent: string[]
  pullOfNew: string[]
  anxietyOfNew: string[]
  allegianceToOld: string[]
  currentSolutions: string[]
  frictionPoints: string[]
  workarounds: string[]
  discoveryPaths: string[]
  buyingProcess: string[]
  painPoints: string[]
  gains: string[]
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

function normalizeThemes(values: unknown, limit: number): BehavioralTheme[] {
  if (!Array.isArray(values)) return []
  return values
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .map((value) => ({
      title: typeof value.title === "string" ? value.title.replace(/\s+/g, " ").trim() : "",
      detail: typeof value.detail === "string" ? value.detail.replace(/\s+/g, " ").trim() : "",
    }))
    .filter((value) => value.title && value.detail)
    .slice(0, limit)
}

function compact(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
}

function truncate(text: string, max = 180): string {
  const normalized = compact(text)
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trimEnd()}...`
}

function topKeywords(signals: RedditReconSignal[], limit = 3): string[] {
  const counts = new Map<string, number>()
  for (const signal of signals) {
    for (const keyword of signal.matched_keywords ?? []) {
      const normalized = compact(keyword)
      if (!normalized) continue
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword)
}

function topSubreddits(signals: RedditReconSignal[], limit = 3): string[] {
  const counts = new Map<string, number>()
  for (const signal of signals) {
    const subreddit = compact(signal.subreddit)
    if (!subreddit) continue
    counts.set(subreddit, (counts.get(subreddit) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([subreddit]) => subreddit)
}

function themeTitle(signal: RedditReconSignal): string {
  const matched = (signal.matched_keywords ?? []).map(compact).filter(Boolean)
  if (matched.length > 0) {
    return `Repeated demand around ${matched.slice(0, 2).join(" and ")}`
  }

  if (signal.signal_type === "buying") return "Active search for a better option"
  if (signal.signal_type === "competitor") return "Replacement motion is surfacing"
  return "Operational pain is showing up in the open"
}

function fallbackSentiment(signals: RedditReconSignal[]): string {
  if (signals.length === 0) {
    return "No recent Reddit conversations are available yet, so sentiment is still ungrounded."
  }

  const hotCount = signals.filter((signal) => (signal.relevance_score ?? 0) >= 8).length
  if (hotCount >= 2) {
    return "Sentiment is urgent and problem-led: people sound tired of patchwork workflows and are actively looking for relief."
  }

  return "Sentiment skews frustrated but pragmatic: people are managing with workarounds, yet they are open to better ways when the upside is concrete."
}

function fallbackThemes(signals: RedditReconSignal[]): BehavioralTheme[] {
  return signals.slice(0, 3).map((signal) => ({
    title: themeTitle(signal),
    detail:
      compact(signal.why_relevant) ||
      truncate(signal.body || signal.title, 220) ||
      "People are describing repeated workflow pain without a clean end-to-end fix.",
  }))
}

function fallbackOverview(context: CompanyContext, signals: RedditReconSignal[]): string {
  const company = compact(context.profile.name) || "your company"
  if (signals.length === 0) {
    return `No Reddit conversations have been synthesized for ${company} yet. Run the behavioral updates scan to turn live subreddit discussions into customer research.`
  }

  const keywords = topKeywords(signals)
  const subreddits = topSubreddits(signals)
  const keywordLabel = keywords.length > 0 ? keywords.join(", ") : "workflow pain and tool evaluation"
  const subredditLabel =
    subreddits.length > 0 ? ` across r/${subreddits.join(", r/")}` : ""

  return `${company} is hearing repeated demand around ${keywordLabel}${subredditLabel}. The conversations are not just feature requests; they describe how buyers are coping today, where they get blocked, and what would need to be true for them to change tools.`
}

function fallbackArray(primary: string, secondary: string, signals: RedditReconSignal[]): string[] {
  const evidence = signals
    .slice(0, 1)
    .map((signal) => compact(signal.why_relevant) || truncate(signal.body || signal.title, 150))
    .filter(Boolean)

  return evidence.length > 0 ? [primary, secondary, evidence[0] as string] : [primary, secondary]
}

function buildFallbackSummary(
  context: CompanyContext,
  signals: RedditReconSignal[],
): RedditBehavioralSummary {
  const keywords = topKeywords(signals)
  const keywordLabel = keywords.length > 0 ? keywords.join(", ") : "their current workflow"
  const company = compact(context.profile.name) || "your company"

  return {
    overview: fallbackOverview(context, signals),
    sentiment: fallbackSentiment(signals),
    themes: fallbackThemes(signals),
    pushOfPresent: fallbackArray(
      `Manual coordination around ${keywordLabel} feels expensive, slow, and too dependent on heroics.`,
      "People are motivated to leave when deadlines, compliance pressure, or stakeholder visibility keep slipping.",
      signals,
    ),
    pullOfNew: [
      `Buyers are drawn to solutions that promise faster execution, better visibility, and less manual cleanup around ${keywordLabel}.`,
      `A credible story for ${company} is fewer fire drills, cleaner handoffs, and more confidence for the team running the process.`,
    ],
    anxietyOfNew: [
      "They worry implementation will be disruptive, expensive, or harder than the demo makes it look.",
      "They also want proof that a new workflow will fit their existing stack, approvals, and reporting requirements.",
    ],
    allegianceToOld: [
      "Teams already know the spreadsheet, ERP, shared-drive, and email stack they are using today.",
      "Existing data, habits, and internal ownership make even a flawed process feel safer than switching.",
    ],
    currentSolutions: [
      "Spreadsheet-led workflows and manual reconciliations remain the default system of record.",
      "Teams are stitching together email, shared docs, exports, and lightweight automation instead of one opinionated workflow.",
    ],
    frictionPoints: [
      "Information is scattered across tools, which creates repeated follow-up and last-minute cleanup.",
      "Visibility is weak: leaders do not feel fully in control until the work is already late or stressful.",
      "Processes break when one person owns too much institutional knowledge.",
    ],
    workarounds: [
      "Extra checklists, one-off exports, Slack reminders, and manual QA right before deadlines.",
      "People build mini-systems around the old stack instead of replacing it outright.",
    ],
    discoveryPaths: [
      "They look for peer recommendations in Reddit threads and software comparison conversations.",
      "Search starts when pain spikes: a deadline, audit, reporting issue, or handoff failure triggers the hunt.",
    ],
    buyingProcess: [
      "The process usually starts with problem validation, then comparison shopping, then internal risk and budget checks.",
      "Trust is won when the solution feels easy to implement and clearly better than the patched workflow they already know.",
    ],
    painPoints: [
      "Operational drag, deadline stress, brittle handoffs, and too much manual effort.",
      "Fear of missed details, rework, and losing credibility with leadership or external stakeholders.",
    ],
    gains: [
      "Success looks like smoother close cycles, fewer surprises, clearer visibility, and more confidence in the numbers or process.",
      "They want to feel proactive instead of constantly recovering.",
    ],
    nextMoves: [
      `Use the strongest Reddit complaints to sharpen ${company}'s problem statement and ICP language.`,
      "Track which frustrations appear repeatedly in the same subreddit because those usually signal a persistent buying trigger.",
      "Test messaging that speaks to the old workflow, the switching fears, and the promised operational win in one story.",
    ],
  }
}

function parseSummaryObject(value: unknown): RedditBehavioralSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const overview = compact(typeof record.overview === "string" ? record.overview : "")
  const sentiment = compact(typeof record.sentiment === "string" ? record.sentiment : "")

  if (!overview) return null

  return {
    overview,
    sentiment,
    themes: normalizeThemes(record.themes, 4),
    pushOfPresent: normalizeLines(record.pushOfPresent, 4),
    pullOfNew: normalizeLines(record.pullOfNew, 4),
    anxietyOfNew: normalizeLines(record.anxietyOfNew, 4),
    allegianceToOld: normalizeLines(record.allegianceToOld, 4),
    currentSolutions: normalizeLines(record.currentSolutions, 5),
    frictionPoints: normalizeLines(record.frictionPoints, 5),
    workarounds: normalizeLines(record.workarounds, 5),
    discoveryPaths: normalizeLines(record.discoveryPaths, 4),
    buyingProcess: normalizeLines(record.buyingProcess, 4),
    painPoints: normalizeLines(record.painPoints, 5),
    gains: normalizeLines(record.gains, 4),
    nextMoves: normalizeLines(record.nextMoves, 4),
  }
}

export function coerceBehavioralSummary(value: unknown): RedditBehavioralSummary | null {
  return parseSummaryObject(value)
}

export async function summarizeRedditRecon(
  context: CompanyContext,
  signals: RedditReconSignal[],
): Promise<RedditBehavioralSummary> {
  const fallback = buildFallbackSummary(context, signals)

  if (signals.length === 0 || !isLlmConfigured()) {
    return fallback
  }

  const sample = signals.slice(0, 14).map((signal) => ({
    title: signal.title,
    body: signal.body,
    subreddit: signal.subreddit,
    signalType: signal.signal_type,
    whyRelevant: signal.why_relevant,
    relevanceScore: signal.relevance_score,
    matchedKeywords: signal.matched_keywords,
    url: signal.url,
  }))

  const prompt = `You are a product strategy analyst converting Reddit discussions into customer research.

COMPANY CONTEXT:
${context.promptBlock}

RECENT REDDIT THREADS:
${JSON.stringify(sample, null, 2)}

Synthesize these threads as secondary customer research. Focus on what buyers are discussing, how they currently solve the problem, what frustrates them, what they are yearning for, and what would make them switch.

Return one JSON object with this exact shape:
{
  "overview": "2-4 sentences that summarize the strongest pattern across the threads",
  "sentiment": "1-2 sentences on overall sentiment and emotional tone",
  "themes": [
    { "title": "short theme", "detail": "1-2 sentence explanation of the pattern" }
  ],
  "pushOfPresent": ["why the current way is painful enough that they want to leave"],
  "pullOfNew": ["what is attractive about a new solution"],
  "anxietyOfNew": ["what makes them nervous about change"],
  "allegianceToOld": ["why they stay with the current way"],
  "currentSolutions": ["how they solve it today"],
  "frictionPoints": ["where they get frustrated"],
  "workarounds": ["what patches or hacks they use"],
  "discoveryPaths": ["how they discover new products or new solutions"],
  "buyingProcess": ["how evaluation and buying tend to happen"],
  "painPoints": ["what keeps them up at night"],
  "gains": ["what success looks like for them"],
  "nextMoves": ["specific product, positioning, or research follow-up"]
}

Rules:
- Treat this as customer research, not sales prospecting.
- Paraphrase the Reddit language. Do not quote long passages.
- Make every line concrete and behavior-focused.
- Connect insights back to the company context when possible.
- Limit themes to 4.
- Keep push/pull/anxiety/allegiance to 4 bullets each.
- Keep currentSolutions, frictionPoints, workarounds, painPoints to 5 bullets each.
- Keep discoveryPaths, buyingProcess, gains, nextMoves to 4 bullets each.
- Return only valid JSON.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 2600,
      messages: [{ role: "user", content: prompt }],
    })

    if (!text) return fallback

    const match = text.match(/\{[\s\S]*\}/)
    const parsed = match ? parseSummaryObject(JSON.parse(match[0]) as unknown) : null
    if (!parsed) return fallback

    return {
      overview: parsed.overview || fallback.overview,
      sentiment: parsed.sentiment || fallback.sentiment,
      themes: parsed.themes.length > 0 ? parsed.themes : fallback.themes,
      pushOfPresent: parsed.pushOfPresent.length > 0 ? parsed.pushOfPresent : fallback.pushOfPresent,
      pullOfNew: parsed.pullOfNew.length > 0 ? parsed.pullOfNew : fallback.pullOfNew,
      anxietyOfNew: parsed.anxietyOfNew.length > 0 ? parsed.anxietyOfNew : fallback.anxietyOfNew,
      allegianceToOld:
        parsed.allegianceToOld.length > 0 ? parsed.allegianceToOld : fallback.allegianceToOld,
      currentSolutions:
        parsed.currentSolutions.length > 0 ? parsed.currentSolutions : fallback.currentSolutions,
      frictionPoints: parsed.frictionPoints.length > 0 ? parsed.frictionPoints : fallback.frictionPoints,
      workarounds: parsed.workarounds.length > 0 ? parsed.workarounds : fallback.workarounds,
      discoveryPaths: parsed.discoveryPaths.length > 0 ? parsed.discoveryPaths : fallback.discoveryPaths,
      buyingProcess: parsed.buyingProcess.length > 0 ? parsed.buyingProcess : fallback.buyingProcess,
      painPoints: parsed.painPoints.length > 0 ? parsed.painPoints : fallback.painPoints,
      gains: parsed.gains.length > 0 ? parsed.gains : fallback.gains,
      nextMoves: parsed.nextMoves.length > 0 ? parsed.nextMoves : fallback.nextMoves,
    }
  } catch (error) {
    console.error("[reddit-recon] summary failed:", error)
    return fallback
  }
}
