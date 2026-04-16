import { generateText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import type { CompanyContext } from "@/lib/company-context"

export type SubredditSuggestion = {
  name: string
  reason: string
  score?: number
  source?: "heuristic" | "llm" | "merged"
}

const SUB_NAME = /^[A-Za-z0-9_]{2,32}$/
const MAX_SCAN_SUBREDDITS = 20

type CatalogEntry = {
  name: string
  reason: string
  priority: number
  signals: string[]
}

const FALLBACK_SUBREDDITS = [
  "startups",
  "entrepreneur",
  "smallbusiness",
  "saas",
  "sales",
  "productmanagement",
]

const SUBREDDIT_CATALOG: CatalogEntry[] = [
  {
    name: "startups",
    reason: "Founders discuss early GTM, positioning, and painful workflow gaps.",
    priority: 10,
    signals: ["startup", "founder", "early stage", "seed", "pre-seed", "venture"],
  },
  {
    name: "entrepreneur",
    reason: "Operators share practical buying and execution tradeoffs for running a business.",
    priority: 9,
    signals: ["entrepreneur", "business owner", "bootstrapped", "small business"],
  },
  {
    name: "smallbusiness",
    reason: "Owners describe real operational pain and tooling decisions under budget pressure.",
    priority: 9,
    signals: ["small business", "smb", "owner operator", "local business"],
  },
  {
    name: "saas",
    reason: "SaaS buyers and builders compare product, onboarding, and retention choices.",
    priority: 9,
    signals: ["saas", "subscription", "churn", "onboarding", "retention"],
  },
  {
    name: "sales",
    reason: "Revenue teams post candidly about outbound friction, demos, and vendor claims.",
    priority: 9,
    signals: ["sales", "outbound", "cold email", "pipeline", "demo", "quota"],
  },
  {
    name: "b2bsales",
    reason: "B2B reps and leaders discuss deal blockers, buyer objections, and proof requirements.",
    priority: 10,
    signals: ["b2b", "enterprise sales", "deal cycle", "procurement", "buying committee"],
  },
  {
    name: "productmanagement",
    reason: "Product teams map customer jobs, prioritization, and switching constraints.",
    priority: 8,
    signals: ["product manager", "product management", "roadmap", "feature request", "workflow"],
  },
  {
    name: "marketing",
    reason: "Growth and demand teams surface discovery channels and messaging friction.",
    priority: 7,
    signals: ["marketing", "demand gen", "positioning", "lead generation", "go to market"],
  },
  {
    name: "growthhacking",
    reason: "Practitioners share experiments, conversion issues, and acquisition lessons.",
    priority: 7,
    signals: ["growth", "acquisition", "conversion", "activation", "funnel"],
  },
  {
    name: "CustomerSuccess",
    reason: "CS teams surface onboarding blockers, renewals, and retention signals.",
    priority: 7,
    signals: ["customer success", "renewal", "expansion", "onboarding", "adoption"],
  },
  {
    name: "CFO",
    reason: "Finance leaders discuss budgeting, risk, and software ROI criteria.",
    priority: 8,
    signals: ["cfo", "finance leader", "budget", "pnl", "roi", "finance team"],
  },
  {
    name: "Accounting",
    reason: "Accounting operators discuss reconciliation pain and process bottlenecks.",
    priority: 7,
    signals: ["accounting", "reconciliation", "close process", "bookkeeping", "controller"],
  },
  {
    name: "fintech",
    reason: "Fintech builders and users compare trust, compliance, and workflow reliability.",
    priority: 8,
    signals: ["fintech", "payments", "banking", "lending", "financial services"],
  },
  {
    name: "ecommerce",
    reason: "Commerce operators discuss tooling gaps, margins, and operational throughput.",
    priority: 7,
    signals: ["ecommerce", "shopify", "merchant", "fulfillment", "store operations"],
  },
  {
    name: "devops",
    reason: "Technical operators share delivery, reliability, and toolchain pain points.",
    priority: 6,
    signals: ["devops", "infrastructure", "ci/cd", "deployment", "platform engineering"],
  },
  {
    name: "sysadmin",
    reason: "Admins discuss reliability, security, and procurement realities for internal tools.",
    priority: 6,
    signals: ["sysadmin", "it ops", "enterprise it", "security operations"],
  },
  {
    name: "cybersecurity",
    reason: "Security practitioners discuss risk, controls, and vendor trust requirements.",
    priority: 6,
    signals: ["security", "cybersecurity", "compliance", "threat", "vulnerability"],
  },
  {
    name: "legaladvice",
    reason: "Legal and regulatory pain points appear here, often with concrete edge cases.",
    priority: 5,
    signals: ["legal", "regulation", "compliance", "contract", "policy"],
  },
  {
    name: "riskmanagement",
    reason: "Risk professionals discuss controls, exposure, and decision tradeoffs.",
    priority: 6,
    signals: ["risk", "risk management", "governance", "controls", "insurance"],
  },
  {
    name: "Insurance",
    reason: "Insurance buyers and operators discuss claims, policy operations, and broker experience.",
    priority: 7,
    signals: ["insurance", "claims", "policy", "underwriting", "broker"],
  },
  {
    name: "insurtech",
    reason: "Insurtech builders discuss modernization gaps and adoption blockers.",
    priority: 7,
    signals: ["insurtech", "insurance software", "underwriting tech", "claims automation"],
  },
]

const CONTEXT_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "your",
  "their",
  "into",
  "about",
  "what",
  "when",
  "where",
  "will",
  "would",
  "should",
  "could",
  "have",
  "has",
  "had",
  "our",
  "you",
  "they",
  "them",
  "are",
  "was",
  "were",
  "been",
  "also",
  "than",
  "then",
  "very",
  "more",
  "most",
  "much",
  "many",
  "across",
  "using",
  "used",
  "use",
  "over",
  "under",
  "between",
])

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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_ ]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !CONTEXT_STOP_WORDS.has(t))
}

function normalizePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function buildContextSignalBag(context: CompanyContext): {
  corpus: string
  tokens: Set<string>
} {
  const { profile, extracted } = context
  const phrases = [
    profile.name,
    profile.description,
    profile.problem,
    profile.solution,
    profile.market,
    profile.industry,
    profile.vertical,
    profile.stage,
    profile.business_model,
    profile.thesis,
    profile.differentiators,
    profile.traction,
    ...profile.icp,
    ...profile.keywords,
    ...profile.competitors,
    ...extracted.icp,
    ...extracted.keywords,
  ]
    .map((p) => normalizePhrase(String(p ?? "")))
    .filter(Boolean)

  const tokenSet = new Set<string>()
  for (const phrase of phrases) {
    for (const t of tokenize(phrase)) tokenSet.add(t)
  }

  return {
    corpus: phrases.join(" | "),
    tokens: tokenSet,
  }
}

function scoreCatalogEntry(
  entry: CatalogEntry,
  contextBag: ReturnType<typeof buildContextSignalBag>,
): { score: number; matches: string[] } {
  let score = entry.priority * 10
  const matches: string[] = []
  const { corpus, tokens } = contextBag

  for (const signal of entry.signals) {
    const normalized = normalizePhrase(signal)
    if (!normalized) continue

    const signalTokens = tokenize(normalized)
    const exactMatch = corpus.includes(normalized)
    const tokenMatch =
      signalTokens.length > 0 && signalTokens.every((token) => tokens.has(token))

    if (!exactMatch && !tokenMatch) continue

    matches.push(normalized)
    score += exactMatch ? 16 : 10
  }

  if (tokens.has(entry.name.toLowerCase())) score += 6

  return { score, matches: matches.slice(0, 3) }
}

function reasonFromMatches(entry: CatalogEntry, matches: string[]): string {
  if (matches.length === 0) return entry.reason
  const formatted = matches.slice(0, 2).join(", ")
  return `Matched ${formatted} in your startup context; this community often discusses buying decisions and workflow pain.`
}

function dedupeAndLimitSuggestions(input: SubredditSuggestion[]): SubredditSuggestion[] {
  const seen = new Set<string>()
  const out: SubredditSuggestion[] = []
  for (const row of input) {
    const normalized = normalizeSubName(String(row.name ?? ""))
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      name: key,
      reason: String(row.reason ?? "Relevant buyer discussion").trim() || "Relevant buyer discussion",
      score: typeof row.score === "number" ? row.score : undefined,
      source: row.source,
    })
    if (out.length >= MAX_SCAN_SUBREDDITS) break
  }
  return out
}

function heuristicSuggestionsFromContext(context: CompanyContext): SubredditSuggestion[] {
  const contextBag = buildContextSignalBag(context)
  const ranked = SUBREDDIT_CATALOG.map((entry) => {
    const { score, matches } = scoreCatalogEntry(entry, contextBag)
    return {
      name: entry.name.toLowerCase(),
      reason: reasonFromMatches(entry, matches),
      score,
      source: "heuristic" as const,
    }
  }).sort((a, b) => {
    const scoreDiff = (b.score ?? 0) - (a.score ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    return a.name.localeCompare(b.name)
  })

  const baseline = FALLBACK_SUBREDDITS.map((name, idx) => ({
    name,
    reason: "Reliable startup and buyer conversation volume for baseline scanning.",
    score: 40 - idx,
    source: "heuristic" as const,
  }))

  return dedupeAndLimitSuggestions([...ranked, ...baseline])
}

async function llmSuggestionsFromContext(
  context: CompanyContext,
  heuristic: SubredditSuggestion[],
): Promise<SubredditSuggestion[]> {
  if (!isLlmConfigured()) return []

  const { profile, promptBlock, extracted } = context
  const icp = [...(profile.icp ?? []), ...(extracted.icp ?? [])].filter(Boolean).slice(0, 10)

  const user = `You are helping a founder choose Reddit communities for customer research.

Company: ${profile.name || "Unknown"}
Industry: ${profile.industry || extracted.vertical || "unknown"}
ICP: ${icp.join(", ").slice(0, 600)}

Context (compressed):
${promptBlock.slice(0, 7000)}

Deterministic starter list (already context-matched):
${heuristic.map((s, idx) => `${idx + 1}. ${s.name} - ${s.reason}`).join("\n")}

Return a JSON array only, no markdown.
Each item must be: {"name":"subreddit_slug","reason":"one sentence"}.
Use 8 to 12 items, no r/ prefix, letters/numbers/underscore only.
Prefer communities where buyers/operators discuss procurement, workflow pain, vendor comparisons, or switching decisions.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(
        "Reply with one JSON array only. No prose before or after. Keep reasons practical.",
      ),
      messages: [{ role: "user", content: user }],
      maxOutputTokens: 1500,
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
      if (!name) continue
      const reason = String(o.reason ?? "").trim().slice(0, 240)
      out.push({
        name: name.toLowerCase(),
        reason: reason || "Suggested from company context.",
        score: 65,
        source: "llm",
      })
    }
    return dedupeAndLimitSuggestions(out)
  } catch (e) {
    console.error("[reddit-subreddit-suggest] llmSuggestionsFromContext:", e)
    return []
  }
}

function mergeSuggestionSets(
  heuristic: SubredditSuggestion[],
  llm: SubredditSuggestion[],
): SubredditSuggestion[] {
  const byName = new Map<string, SubredditSuggestion>()

  for (const row of heuristic) {
    byName.set(row.name.toLowerCase(), { ...row, source: "heuristic" })
  }

  for (const row of llm) {
    const key = row.name.toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { ...row, source: "llm" })
      continue
    }
    const mergedReason =
      existing.reason === row.reason ? existing.reason : `${existing.reason} ${row.reason}`.slice(0, 320)
    byName.set(key, {
      name: key,
      reason: mergedReason,
      score: Math.max(existing.score ?? 0, row.score ?? 0) + 6,
      source: "merged",
    })
  }

  return dedupeAndLimitSuggestions(
    [...byName.values()].sort((a, b) => {
      const scoreDiff = (b.score ?? 0) - (a.score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return a.name.localeCompare(b.name)
    }),
  )
}

/**
 * Produces subreddit names for Reddit intent scanning from company context.
 * Uses deterministic ranking first, then optional LLM enrichment.
 */
export async function suggestSubredditsFromContext(
  context: CompanyContext,
): Promise<SubredditSuggestion[]> {
  const heuristic = heuristicSuggestionsFromContext(context)
  const llm = await llmSuggestionsFromContext(context, heuristic)
  return mergeSuggestionSets(heuristic, llm)
}

/**
 * Deterministic subreddit defaults for UI/scan flows.
 * Never depends on LLM availability.
 */
export function defaultSubredditsFromContext(context: CompanyContext): string[] {
  const suggested = heuristicSuggestionsFromContext(context).map((row) => row.name.toLowerCase())
  if (suggested.length > 0) return suggested.slice(0, MAX_SCAN_SUBREDDITS)
  return FALLBACK_SUBREDDITS.slice(0, MAX_SCAN_SUBREDDITS)
}

/**
 * Deduped list for Reddit search.
 * Priority: 1) user-pinned saved list, 2) context-derived suggestions, 3) universal fallback.
 * Suggestions are generated from the active startup context to prevent cross-account bleed.
 */
export async function resolveSubredditsForIntentScan(context: CompanyContext): Promise<string[]> {
  // 1) User pinned list.
  const saved = context.profile.reddit_intent_subreddits
  if (saved?.length) {
    const cleaned = [...new Set(saved.map((s) => normalizeSubName(s)).filter(Boolean) as string[])].map(
      (s) => s.toLowerCase(),
    )
    if (cleaned.length > 0) return cleaned.slice(0, MAX_SCAN_SUBREDDITS)
  }

  // 2) Context-driven suggestions (deterministic + optional LLM).
  const suggested = await suggestSubredditsFromContext(context)
  const fromAi = [...new Set(suggested.map((s) => s.name.toLowerCase()))]
  if (fromAi.length > 0) return fromAi.slice(0, MAX_SCAN_SUBREDDITS)

  // 3) Final fallback.
  return FALLBACK_SUBREDDITS.slice(0, MAX_SCAN_SUBREDDITS)
}
