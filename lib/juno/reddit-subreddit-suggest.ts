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
  // ── Founders & Operators ──────────────────────────────────────────────────
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
    name: "Entrepreneur_Ride_Along",
    reason: "Bootstrapped founders share unfiltered build-in-public updates and product decisions.",
    priority: 8,
    signals: ["bootstrapped", "indie hacker", "solo founder", "build in public", "side project"],
  },
  {
    name: "indiehackers",
    reason: "Indie builders discuss monetization, tool choices, and early traction experiments.",
    priority: 8,
    signals: ["indie hacker", "bootstrapped", "mrr", "solo founder", "side project", "niche product"],
  },
  {
    name: "sideproject",
    reason: "Builders share early-stage products and get candid feedback on value propositions.",
    priority: 7,
    signals: ["side project", "side hustle", "launch", "mvp", "personal project"],
  },
  // ── Revenue & Sales ───────────────────────────────────────────────────────
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
    name: "salestechniques",
    reason: "Practitioners debate closing tactics, discovery questions, and tool effectiveness.",
    priority: 7,
    signals: ["sales technique", "closing", "discovery", "objection handling", "cold call"],
  },
  {
    name: "RevOps",
    reason: "Revenue Operations teams discuss CRM hygiene, attribution, and stack consolidation.",
    priority: 8,
    signals: ["revops", "revenue operations", "crm", "attribution", "stack", "hubspot", "salesforce"],
  },
  // ── Product & Growth ──────────────────────────────────────────────────────
  {
    name: "saas",
    reason: "SaaS buyers and builders compare product, onboarding, and retention choices.",
    priority: 9,
    signals: ["saas", "subscription", "churn", "onboarding", "retention"],
  },
  {
    name: "productmanagement",
    reason: "Product teams map customer jobs, prioritization, and switching constraints.",
    priority: 8,
    signals: ["product manager", "product management", "roadmap", "feature request", "workflow"],
  },
  {
    name: "ProductLed",
    reason: "PLG practitioners discuss activation, freemium conversion, and self-serve onboarding.",
    priority: 8,
    signals: ["product led growth", "plg", "self-serve", "freemium", "activation", "free trial"],
  },
  {
    name: "marketing",
    reason: "Growth and demand teams surface discovery channels and messaging friction.",
    priority: 7,
    signals: ["marketing", "demand gen", "positioning", "lead generation", "go to market"],
  },
  {
    name: "digital_marketing",
    reason: "Digital marketers debate channel mix, performance, and martech tooling.",
    priority: 7,
    signals: ["digital marketing", "paid ads", "ppc", "seo", "social media marketing", "email marketing"],
  },
  {
    name: "growthhacking",
    reason: "Practitioners share experiments, conversion issues, and acquisition lessons.",
    priority: 7,
    signals: ["growth", "acquisition", "conversion", "activation", "funnel"],
  },
  {
    name: "SEO",
    reason: "SEO practitioners discuss rankings, content strategy, and organic channel performance.",
    priority: 7,
    signals: ["seo", "search engine", "organic traffic", "content strategy", "backlinks", "serp"],
  },
  {
    name: "content_marketing",
    reason: "Content teams discuss editorial calendars, distribution, and buyer education.",
    priority: 6,
    signals: ["content marketing", "content strategy", "editorial", "thought leadership", "blog"],
  },
  {
    name: "CustomerSuccess",
    reason: "CS teams surface onboarding blockers, renewals, and retention signals.",
    priority: 7,
    signals: ["customer success", "renewal", "expansion", "onboarding", "adoption"],
  },
  // ── Finance & Accounting ──────────────────────────────────────────────────
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
    name: "personalfinance",
    reason: "Consumers and self-employed discuss financial tooling, budgeting apps, and advisor pain.",
    priority: 6,
    signals: ["personal finance", "budgeting", "financial planning", "wealth management", "consumer finance"],
  },
  {
    name: "investing",
    reason: "Retail and professional investors discuss platforms, research tools, and portfolio pain.",
    priority: 6,
    signals: ["investing", "portfolio", "equity", "asset management", "investment platform"],
  },
  // ── HR, People & Recruiting ───────────────────────────────────────────────
  {
    name: "humanresources",
    reason: "HR generalists and leaders discuss compliance, tooling, and workforce pain.",
    priority: 9,
    signals: ["hr", "human resources", "people ops", "hris", "employee", "workforce", "talent"],
  },
  {
    name: "recruiting",
    reason: "Recruiters debate sourcing, ATS pain, and candidate experience gaps.",
    priority: 9,
    signals: ["recruiting", "recruiter", "ats", "sourcing", "talent acquisition", "hiring"],
  },
  {
    name: "PeopleManagement",
    reason: "Managers discuss performance, engagement, and operational people decisions.",
    priority: 7,
    signals: ["people management", "manager", "team lead", "performance review", "1on1", "engagement"],
  },
  {
    name: "hrtech",
    reason: "HR tech buyers and practitioners compare vendors, integrations, and ROI claims.",
    priority: 8,
    signals: ["hrtech", "hr software", "payroll software", "hcm", "workforce management"],
  },
  {
    name: "payroll",
    reason: "Payroll and comp operators discuss compliance edge cases and system pain.",
    priority: 7,
    signals: ["payroll", "payroll processing", "payroll software", "compensation", "benefits administration"],
  },
  // ── Technology & Engineering ──────────────────────────────────────────────
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
    name: "softwarearchitecture",
    reason: "Engineers debate system design tradeoffs and tooling choices at scale.",
    priority: 6,
    signals: ["software architecture", "system design", "api", "microservices", "scalability"],
  },
  {
    name: "webdev",
    reason: "Web developers discuss tooling, frameworks, and build pipeline decisions.",
    priority: 6,
    signals: ["web development", "frontend", "backend", "api", "web app", "developer tools"],
  },
  {
    name: "nocode",
    reason: "No-code builders share tooling choices, automation pain, and platform comparisons.",
    priority: 7,
    signals: ["no code", "nocode", "low code", "automation", "zapier", "make", "airtable"],
  },
  {
    name: "dataengineering",
    reason: "Data engineers discuss pipeline reliability, tooling, and warehouse decisions.",
    priority: 7,
    signals: ["data engineering", "data pipeline", "etl", "data warehouse", "dbt", "airflow"],
  },
  {
    name: "BusinessIntelligence",
    reason: "BI teams discuss dashboards, reporting pain, and tool sprawl.",
    priority: 7,
    signals: ["business intelligence", "bi", "analytics", "dashboard", "reporting", "tableau", "power bi"],
  },
  {
    name: "MachineLearning",
    reason: "ML practitioners discuss model deployment, tooling, and production pain.",
    priority: 6,
    signals: ["machine learning", "ml", "model", "ai model", "nlp", "llm", "inference"],
  },
  {
    name: "artificial",
    reason: "AI practitioners and buyers discuss adoption, tooling, and workflow integration.",
    priority: 7,
    signals: ["artificial intelligence", "ai tool", "ai software", "generative ai", "ai adoption"],
  },
  {
    name: "LocalLLaMA",
    reason: "AI-native builders debate model choices, API cost, and on-premise alternatives.",
    priority: 6,
    signals: ["llm", "language model", "ai api", "openai", "anthropic", "fine tuning", "embeddings"],
  },
  // ── Insurance & Risk ──────────────────────────────────────────────────────
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
  {
    name: "InsuranceAgent",
    reason: "Agents and brokers surface day-to-day workflow pain, carrier comparison, and commission frustrations.",
    priority: 8,
    signals: ["insurance agent", "broker", "p&c", "carrier", "commission", "agency management"],
  },
  {
    name: "HealthInsurance",
    reason: "Health insurance buyers and administrators discuss plan selection, billing, and coverage gaps.",
    priority: 7,
    signals: ["health insurance", "benefits", "group health", "self-insured", "stop-loss", "payer"],
  },
  {
    name: "CommercialInsurance",
    reason: "Commercial lines professionals discuss complex risk placement and client operations.",
    priority: 8,
    signals: ["commercial insurance", "commercial lines", "gl", "e&o", "d&o", "cyber insurance", "excess surplus"],
  },
  {
    name: "actuaries",
    reason: "Actuaries discuss pricing models, reserving, and data quality challenges in insurance.",
    priority: 7,
    signals: ["actuarial", "actuary", "reserving", "pricing model", "loss ratio", "mortality", "life insurance"],
  },
  {
    name: "Compliance",
    reason: "Compliance officers discuss regulatory requirements, audit readiness, and control frameworks.",
    priority: 7,
    signals: ["compliance", "regulatory", "audit", "controls", "insurance regulation", "state filing"],
  },
  {
    name: "riskmanagement",
    reason: "Risk professionals discuss controls, exposure, and decision tradeoffs.",
    priority: 6,
    signals: ["risk", "risk management", "governance", "controls", "insurance"],
  },
  // ── Legal & Compliance ────────────────────────────────────────────────────
  {
    name: "legaladvice",
    reason: "Legal and regulatory pain points appear here, often with concrete edge cases.",
    priority: 5,
    signals: ["legal", "regulation", "compliance", "contract", "policy"],
  },
  {
    name: "legaltech",
    reason: "Legal tech buyers compare document management, e-discovery, and contract automation.",
    priority: 7,
    signals: ["legaltech", "legal software", "contract management", "e-discovery", "legal operations", "clm"],
  },
  {
    name: "law",
    reason: "Attorneys and legal ops discuss workflow, billing, and practice management pain.",
    priority: 6,
    signals: ["law", "attorney", "lawyer", "legal practice", "law firm", "legal operations"],
  },
  // ── Healthcare & Life Sciences ────────────────────────────────────────────
  {
    name: "healthcareit",
    reason: "Healthcare IT buyers discuss EHR pain, interoperability, and vendor lock-in.",
    priority: 9,
    signals: ["healthcare it", "ehr", "emr", "health informatics", "interoperability", "hipaa", "clinical workflow"],
  },
  {
    name: "medicine",
    reason: "Clinicians discuss operational pain, tooling gaps, and workflow inefficiencies.",
    priority: 7,
    signals: ["healthcare", "clinical", "physician", "hospital", "medical", "patient care", "health system"],
  },
  {
    name: "nursing",
    reason: "Nurses surface frontline care delivery friction and documentation pain.",
    priority: 6,
    signals: ["nursing", "nurse", "clinical staff", "bedside", "care coordination"],
  },
  {
    name: "medicaldevices",
    reason: "MedTech professionals discuss regulatory, procurement, and integration challenges.",
    priority: 7,
    signals: ["medical device", "medtech", "fda", "regulatory", "clinical trial", "diagnostic"],
  },
  {
    name: "digitalhealth",
    reason: "Digital health builders and buyers discuss adoption, reimbursement, and interoperability.",
    priority: 8,
    signals: ["digital health", "telehealth", "remote patient monitoring", "health app", "wearable", "patient engagement"],
  },
  // ── Real Estate & PropTech ────────────────────────────────────────────────
  {
    name: "realestateinvesting",
    reason: "Real estate investors discuss deal analysis, tooling, and portfolio operations.",
    priority: 7,
    signals: ["real estate", "property management", "landlord", "investment property", "cap rate", "deal flow"],
  },
  {
    name: "CommercialRealEstate",
    reason: "CRE professionals discuss leasing, asset management, and market intelligence.",
    priority: 7,
    signals: ["commercial real estate", "cre", "office", "retail space", "industrial", "leasing"],
  },
  {
    name: "proptech",
    reason: "PropTech builders and buyers discuss workflow gaps and platform comparisons.",
    priority: 8,
    signals: ["proptech", "real estate software", "property tech", "real estate crm", "property management software"],
  },
  // ── Logistics, Supply Chain & Operations ─────────────────────────────────
  {
    name: "supplychain",
    reason: "Supply chain professionals discuss visibility gaps, vendor pain, and planning tools.",
    priority: 8,
    signals: ["supply chain", "procurement", "sourcing", "vendor management", "inventory", "logistics"],
  },
  {
    name: "logistics",
    reason: "Logistics operators discuss routing, last-mile, and TMS platform tradeoffs.",
    priority: 7,
    signals: ["logistics", "freight", "shipping", "last mile", "fulfillment", "3pl", "carrier"],
  },
  {
    name: "manufacturing",
    reason: "Manufacturing operators discuss MES, ERP gaps, and operational throughput.",
    priority: 7,
    signals: ["manufacturing", "factory", "production", "industrial", "erp", "mes", "quality control"],
  },
  {
    name: "ecommerce",
    reason: "Commerce operators discuss tooling gaps, margins, and operational throughput.",
    priority: 7,
    signals: ["ecommerce", "shopify", "merchant", "fulfillment", "store operations"],
  },
  // ── Education & EdTech ────────────────────────────────────────────────────
  {
    name: "edtech",
    reason: "EdTech builders and buyers discuss LMS gaps, learner engagement, and procurement.",
    priority: 8,
    signals: ["edtech", "education technology", "lms", "e-learning", "online learning", "training platform"],
  },
  {
    name: "Teachers",
    reason: "Educators surface instructional tooling pain and curriculum workflow frustrations.",
    priority: 6,
    signals: ["education", "teacher", "classroom", "curriculum", "school", "k12", "higher education"],
  },
  {
    name: "highereducation",
    reason: "University administrators discuss admissions, student systems, and institutional software.",
    priority: 6,
    signals: ["higher education", "university", "college", "admissions", "student information system", "campus"],
  },
  // ── Professional Services & Agency ────────────────────────────────────────
  {
    name: "consulting",
    reason: "Consultants and agency owners discuss project delivery, tooling, and client operations.",
    priority: 7,
    signals: ["consulting", "consultant", "professional services", "advisory", "management consulting"],
  },
  {
    name: "agency",
    reason: "Agency operators discuss workflow, client management, and service delivery tools.",
    priority: 7,
    signals: ["agency", "marketing agency", "digital agency", "creative agency", "client work"],
  },
  {
    name: "freelance",
    reason: "Freelancers discuss client management, invoicing, and productivity tooling.",
    priority: 6,
    signals: ["freelance", "freelancer", "independent contractor", "solopreneur", "gig work"],
  },
  // ── Non-profit & Social Impact ────────────────────────────────────────────
  {
    name: "nonprofit",
    reason: "Non-profit operators discuss donor management, grant tooling, and operational constraints.",
    priority: 6,
    signals: ["nonprofit", "non-profit", "charity", "foundation", "social impact", "donor management"],
  },
  // ── Hospitality & Food Service ────────────────────────────────────────────
  {
    name: "restaurantowners",
    reason: "Restaurant operators discuss POS pain, staffing, and operational tooling decisions.",
    priority: 7,
    signals: ["restaurant", "food service", "hospitality", "pos system", "table management", "qsr"],
  },
  // ── Construction & Trades ─────────────────────────────────────────────────
  {
    name: "Construction",
    reason: "Construction operators discuss project management, estimating, and subcontractor tools.",
    priority: 7,
    signals: ["construction", "general contractor", "subcontractor", "project management", "estimating", "jobsite"],
  },
  // ── Project Management & Productivity ─────────────────────────────────────
  {
    name: "projectmanagement",
    reason: "PMs discuss tooling choices, workflow pain, and cross-team coordination gaps.",
    priority: 7,
    signals: ["project management", "project manager", "pm tool", "gantt", "agile", "jira", "notion"],
  },
  {
    name: "productivity",
    reason: "Knowledge workers discuss workflow optimization, tool stacks, and automation.",
    priority: 6,
    signals: ["productivity", "workflow", "automation", "tool stack", "efficiency", "time management"],
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

  const user = `You are helping a founder discover Reddit communities for customer research and buyer intent monitoring.

Company: ${profile.name || "Unknown"}
Industry: ${profile.industry || extracted.vertical || "unknown"}
ICP: ${icp.join(", ").slice(0, 600)}

Context (compressed):
${promptBlock.slice(0, 7000)}

Starter list already identified (DO NOT repeat these):
${heuristic.map((s) => s.name).join(", ")}

Your job: find ADDITIONAL subreddits the starter list missed.

Think across these discovery angles:
1. Role/persona communities — where does the ICP spend time? (e.g. r/humanresources, r/recruiting, r/CFO, r/nursing)
2. Industry verticals — niche industry forums the ICP would be in (e.g. r/healthcareit, r/legaltech, r/supplychain)
3. Problem/pain communities — forums organized around the problem being solved (e.g. r/payroll, r/nocode, r/dataengineering)
4. Tool/platform communities — subreddits for tools the ICP currently uses or evaluates (e.g. r/salesforce, r/hubspot, r/notion)
5. Competitor communities — where users complain about or compare alternatives
6. Adjacent buyer communities — colleagues or influencers who affect the buying decision

Return a JSON array only, no markdown.
Each item must be: {"name":"subreddit_slug","reason":"one sentence explaining why buyers here are relevant"}.
Return 15 to 20 items, no r/ prefix, letters/numbers/underscore only, each subreddit must actually exist on Reddit.
Prefer communities where real buyers discuss workflow pain, vendor comparisons, procurement decisions, or switching costs.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(
        "Reply with one JSON array only. No prose before or after. Keep reasons practical.",
      ),
      messages: [{ role: "user", content: user }],
      maxOutputTokens: 2500,
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
        score: 75,
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
