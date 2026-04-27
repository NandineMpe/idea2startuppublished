import crypto from "node:crypto"

export type AuditRawItem = {
  id: string
  title: string
  url: string
  source: string
  publishedAt: string
  snippet: string
  author?: string
}

type RssSource = { name: string; url: string }

/** Max items per feed so no single source crowds out others. */
const MAX_ITEMS_PER_FEED = 25
const MAX_TOTAL_ITEMS = 300
const LOOKBACK_DAYS = 45

const CORE_ACCOUNTING_AUDIT_QUERIES = [
  "accounting audit news",
  "auditing news",
  "audit quality",
  "financial reporting news",
  "accounting standards update",
  "FASB accounting standards",
  "AICPA audit accounting",
  "PCAOB audit inspection enforcement",
  "SEC accounting enforcement financial reporting",
  "audit firm AI",
  "AI auditing accounting",
  "generative AI audit accounting",
  "audit automation",
  "continuous auditing",
  "internal controls financial reporting",
  "SOX compliance audit",
  "revenue recognition accounting",
  "lease accounting",
  "ESG assurance audit",
  "audit technology software",
  "accounting firm technology",
  "audit partner demotions",
  "audit partner layoffs",
  "salaried partners accounting firm",
  "Big Four audit partners",
  "Big Four accounting AI audit",
  "audit workforce AI accounting",
  "accounting students AI audit",
  "audit education AI simulations",
  "university accounting AI simulations",
  "FRC AI audit guidance",
  "Financial Reporting Council AI auditing",
  "ICAEW AI audit",
  "ACCA AI accounting exams",
  "IFIAR audit quality AI",
  "audit deficiency report Big Four",
]

const AUDIT_FIRM_TERMS = [
  "KPMG",
  "Deloitte",
  "EY",
  "PwC",
  "BDO",
  "Forvis Mazars",
  "Grant Thornton",
  "RSM",
]

const REGULATOR_AND_BODY_TERMS = [
  "PCAOB",
  "FRC",
  "Financial Reporting Council",
  "SEC",
  "FASB",
  "AICPA",
  "ICAEW",
  "ACCA",
  "IASB",
  "IFIAR",
]

const HIGH_SIGNAL_EXACT_QUERIES = [
  "KPMG cuts audit partners",
  "KPMG audit partner demotions",
  "KPMG EY demote partners salaried positions",
  "KPMG UK AI audit university students",
  "KPMG Financial Reporting Council AI audit",
  "FRC AI simulations audit students",
  "FRC AI audit guidance human responsibility",
  "KPMG AI financial reporting audit",
  "KPMG Clara AI audit agents",
  "EY Canvas AI audit platform",
  "PwC AI audit accounting",
  "Deloitte AI audit accounting",
]

const AUTHORITATIVE_AND_TRADE_FEEDS: RssSource[] = [
  { name: "SEC Press Releases", url: "https://www.sec.gov/news/pressreleases.rss" },
  { name: "Journal of Accountancy", url: "https://www.journalofaccountancy.com/news.rss" },
  { name: "Accounting Today", url: "https://www.accountingtoday.com/feed" },
  { name: "CPA Practice Advisor", url: "https://www.cpapracticeadvisor.com/feed/" },
  { name: "CFO Dive", url: "https://www.cfodive.com/feeds/news/" },
]

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))
  return m?.[1]?.trim() ?? ""
}

function extractAtomLink(entry: string): string {
  const href = entry.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i)?.[1]
  if (href) return href.trim()
  return decodeXmlEntities(stripHtml(extractTag(entry, "link")))
}

function googleNewsRss(query: string): RssSource {
  const q = query.includes("when:") ? query : `${query} when:${LOOKBACK_DAYS}d`
  return {
    name: `Google News: ${query.slice(0, 80)}`,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
  }
}

function normalizeTerm(term: string): string {
  return term.replace(/\s+/g, " ").trim()
}

function addQuery(queries: string[], query: string) {
  const q = normalizeTerm(query)
  if (q.length > 2) queries.push(q)
}

/**
 * Build Google News queries from company context so every account
 * gets signals relevant to their specific industry and ICP.
 */
export function buildContextNewsQueries(params: {
  companyName: string
  industry: string
  vertical: string
  keywords: string[]
  competitors: string[]
}): RssSource[] {
  const { companyName, industry, vertical, keywords, competitors } = params

  const queries: string[] = []

  for (const q of CORE_ACCOUNTING_AUDIT_QUERIES) addQuery(queries, q)
  for (const q of HIGH_SIGNAL_EXACT_QUERIES) addQuery(queries, q)

  for (const firm of AUDIT_FIRM_TERMS) {
    addQuery(queries, `${firm} audit AI`)
    addQuery(queries, `${firm} audit quality`)
    addQuery(queries, `${firm} accounting firm partners`)
    addQuery(queries, `${firm} audit workforce`)
  }

  for (const body of REGULATOR_AND_BODY_TERMS) {
    addQuery(queries, `${body} audit AI`)
    addQuery(queries, `${body} accounting audit update`)
  }

  // Industry + audit/accounting signals.
  if (industry) {
    addQuery(queries, `${industry} accounting audit`)
    addQuery(queries, `${industry} financial reporting`)
    addQuery(queries, `${industry} audit compliance`)
    addQuery(queries, `${industry} AI accounting`)
  }
  if (vertical && vertical !== industry) {
    addQuery(queries, `${vertical} accounting audit`)
    addQuery(queries, `${vertical} AI audit`)
  }

  // Top keywords from context, tied back to accounting/audit so generic company
  // terms do not dominate the search set.
  const topKeywords = keywords.slice(0, 10)
  for (const kw of topKeywords) {
    addQuery(queries, `${kw} audit accounting`)
    addQuery(queries, `${kw} financial reporting`)
  }

  // Competitor and adjacent vendor moves.
  for (const c of competitors.slice(0, 8)) {
    addQuery(queries, `${c} audit accounting AI`)
    addQuery(queries, `${c} financial reporting`)
  }

  // Company name signals
  if (companyName && companyName !== "My Company") {
    addQuery(queries, `${companyName} accounting audit`)
    addQuery(queries, `${companyName} AI audit`)
  }

  // Deduplicate and cap
  const unique = [...new Set(queries)].slice(0, 90)
  return [...AUTHORITATIVE_AND_TRADE_FEEDS, ...unique.map(googleNewsRss)]
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ""
    for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      u.searchParams.delete(param)
    }
    return u.toString()
  } catch {
    return url.split("#")[0]
  }
}

function relevanceScore(item: AuditRawItem, params: {
  companyName: string
  industry: string
  vertical: string
  keywords: string[]
  competitors: string[]
}): number {
  const text = `${item.source} ${item.title} ${item.snippet}`.toLowerCase()
  let score = 0

  if (/(audit|auditing|auditor|assurance|pcaob|aicpa|fasb|gaap|ifrs|sec|sox|internal control|financial reporting|accounting|cpa|cfo|controller)/i.test(text)) score += 5
  if (/(artificial intelligence|\bai\b|generative ai|automation|software|platform|technology|analytics|continuous auditing)/i.test(text)) score += 2
  if (/(enforcement|inspection|standard|rule|guidance|report|survey|study|lawsuit|settlement|restatement|material weakness|deficiency)/i.test(text)) score += 2
  if (/(kpmg|deloitte|ey|pwc|bdo|forvis mazars|grant thornton|rsm|big four)/i.test(text)) score += 3
  if (/(partner|partners|demot|salaried partner|layoff|redundanc|cuts|workforce|promotion|retirement|productivity)/i.test(text)) score += 3
  if (/(university|student|education|training|simulation|simulations|curriculum|exam|graduate|first year)/i.test(text)) score += 3
  if (/(frc|financial reporting council|pcaob|sec|aicpa|icaew|acca|fasb|iasb|ifiar)/i.test(text)) score += 3

  const companyTerms = [params.companyName, params.industry, params.vertical, ...params.keywords, ...params.competitors]
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 2)
    .slice(0, 30)
  for (const term of companyTerms) {
    if (text.includes(term)) score += 1
  }

  const ageDays = (Date.now() - new Date(item.publishedAt).getTime()) / (24 * 60 * 60 * 1000)
  if (ageDays <= 7) score += 2
  else if (ageDays <= 21) score += 1

  return score
}

async function fetchRssItems(feeds: RssSource[], cutoff: Date): Promise<AuditRawItem[]> {
  const out: AuditRawItem[] = []
  const seen = new Set<string>()
  const perFeedCount = new Map<string, number>()

  await Promise.all(
    feeds.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "JunoDigest/1.0 (+https://idea2startuppublished.vercel.app)" },
          signal: AbortSignal.timeout(12000),
        })
        if (!res.ok) return
        const xml = await res.text()
        const isAtom = xml.includes("<entry")
        const blocks = isAtom
          ? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
          : xml.match(/<item[\s\S]*?<\/item>/gi) ?? []

        for (const block of blocks) {
          const n = perFeedCount.get(feed.url) ?? 0
          if (n >= MAX_ITEMS_PER_FEED) break

          const title = decodeXmlEntities(stripHtml(extractTag(block, "title")))
          const link = decodeXmlEntities(
            stripHtml(isAtom ? extractAtomLink(block) : extractTag(block, "link")),
          )
          const desc = decodeXmlEntities(
            stripHtml(
              isAtom
                ? extractTag(block, "summary") || extractTag(block, "content")
                : extractTag(block, "description") || extractTag(block, "content:encoded"),
            ),
          )
          const pubStr = isAtom
            ? extractTag(block, "published") || extractTag(block, "updated")
            : extractTag(block, "pubDate") || extractTag(block, "dc:date")

          if (!title || !link) continue
          const parsed = new Date(pubStr || Date.now())
          const publishedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed
          if (publishedAt < cutoff) continue
          const canonical = canonicalUrl(link)
          if (seen.has(canonical)) continue
          seen.add(canonical)
          perFeedCount.set(feed.url, n + 1)

          out.push({
            id: crypto.createHash("sha256").update(`rss:${canonical}`).digest("hex").slice(0, 24),
            title: title.slice(0, 300),
            url: canonical,
            source: feed.name,
            publishedAt: publishedAt.toISOString(),
            snippet: desc.slice(0, 800),
          })
        }
      } catch {
        // feed unavailable, skip silently
      }
    }),
  )

  return out
}

export async function fetchContextualNewsItems(params: {
  companyName: string
  industry: string
  vertical: string
  keywords: string[]
  competitors: string[]
}): Promise<AuditRawItem[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const feeds = buildContextNewsQueries(params)
  const items = await fetchRssItems(feeds, cutoff).catch(() => [] as AuditRawItem[])
  items.sort((a, b) => {
    const scoreDelta = relevanceScore(b, params) - relevanceScore(a, params)
    if (scoreDelta !== 0) return scoreDelta
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  })
  return items.slice(0, MAX_TOTAL_ITEMS)
}

// ── Legacy export kept so existing imports don't break ───────────────────────
/** @deprecated Use fetchContextualNewsItems with company context instead */
export async function fetchAllAuditAiItems(): Promise<AuditRawItem[]> {
  return fetchContextualNewsItems({
    companyName: "",
    industry: "accounting",
    vertical: "audit",
    keywords: ["AI", "software", "automation", "audit", "financial reporting"],
    competitors: [],
  })
}
