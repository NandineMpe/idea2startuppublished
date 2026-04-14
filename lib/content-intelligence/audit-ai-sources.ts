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

// ── RSS + Atom feeds for audit / accounting ──────────────────────────────────

type AuditRssSource = {
  name: string
  url: string
}

/** Multiple outlets so the digest is not dominated by a single blog. URLs are best-effort; failed feeds are skipped. */
const AUDIT_RSS_FEEDS: AuditRssSource[] = [
  { name: "AccountingToday", url: "https://www.accountingtoday.com/feed" },
  { name: "Journal of Accountancy", url: "https://www.journalofaccountancy.com/rss/all-news.xml" },
  { name: "AICPA Insights", url: "https://www.aicpa-cima.com/blog/rss" },
  { name: "IFAC Knowledge Gateway", url: "https://www.ifac.org/knowledge-gateway/rss.xml" },
  { name: "Thomson Reuters Tax & Accounting", url: "https://tax.thomsonreuters.com/blog/feed/" },
  { name: "Wolters Kluwer (CCH Tagetik blog)", url: "https://www.wolterskluwer.com/en/solutions/cch-tagetik/blog/feed" },
  { name: "CPA Practice Advisor", url: "https://www.cpapracticeadvisor.com/feed" },
  { name: "Going Concern", url: "https://www.goingconcern.com/feed/" },
]

/** Free Google News RSS (no API key). One feed URL per query. */
const GOOGLE_NEWS_AUDIT_QUERIES = [
  "KPMG AI audit",
  "Deloitte AI audit technology",
  "PwC artificial intelligence assurance",
  "EY AI audit innovation",
  "Big Four AI audit",
  "PCAOB artificial intelligence",
]

const GOOGLE_NEWS_RSS_FEEDS: AuditRssSource[] = GOOGLE_NEWS_AUDIT_QUERIES.map((q) => ({
  name: "Google News",
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
}))

const ALL_AUDIT_FEEDS: AuditRssSource[] = [...AUDIT_RSS_FEEDS, ...GOOGLE_NEWS_RSS_FEEDS]

/** Max items kept per feed URL so one source does not crowd out the rest. */
const MAX_ITEMS_PER_RSS_FEED = 12

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

const AUDIT_PROFESSION_KEYWORDS =
  /\b(audit|assurance|auditor|auditing|external audit|internal audit|public accounting|pcaob|aicpa|isae|iaasb|iasb|gaap|ifrs|sox|sec registrant|big four|big 4|kpmg|deloitte|ey\b|ernst|pwc|pricewaterhouse|grant thornton|bdo|mazars|caq)\b/i

const AI_KEYWORDS =
  /\b(ai|artificial intelligence|machine learning|llm|gpt|genai|chatgpt)\b/i

const AUDIT_TECH_PHRASES =
  /\b(audit tech|digital audit|audit automation|continuous audit|audit software|evidence\s+(ai|analytics)|algorithmic audit)\b/i

const TECH_ADJACENT =
  /\b(software|platform|saas|automation|analytics|cloud|digital|innovation|transformation|robotic process|rpa\b|data analytics)\b/i

function isAuditAiRelevant(title: string, desc: string): boolean {
  const combined = `${title} ${desc}`
  if (AUDIT_TECH_PHRASES.test(combined)) return true
  if (AI_KEYWORDS.test(combined) && AUDIT_PROFESSION_KEYWORDS.test(combined)) return true
  if (AUDIT_PROFESSION_KEYWORDS.test(combined) && TECH_ADJACENT.test(combined)) return true
  return false
}

export async function fetchAuditRssItems(): Promise<AuditRawItem[]> {
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  const out: AuditRawItem[] = []
  const seen = new Set<string>()

  const perFeedUrlCount = new Map<string, number>()

  await Promise.all(
    ALL_AUDIT_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "JunoAuditDigest/1.0 (audit digest; +https://idea2startuppublished.vercel.app)" },
          signal: AbortSignal.timeout(12000),
        })
        if (!res.ok) return
        const xml = await res.text()
        const isAtom = xml.includes("<entry")
        const blocks = isAtom
          ? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
          : xml.match(/<item[\s\S]*?<\/item>/gi) ?? []

        for (const block of blocks) {
          const n = perFeedUrlCount.get(feed.url) ?? 0
          if (n >= MAX_ITEMS_PER_RSS_FEED) break

          const title = decodeXmlEntities(stripHtml(isAtom ? extractTag(block, "title") : extractTag(block, "title")))
          const link = decodeXmlEntities(stripHtml(isAtom ? extractAtomLink(block) : extractTag(block, "link")))
          const desc = decodeXmlEntities(
            stripHtml(
              isAtom
                ? extractTag(block, "summary") || extractTag(block, "content")
                : extractTag(block, "description") || extractTag(block, "content:encoded"),
            ),
          )
          const pubStr =
            isAtom
              ? extractTag(block, "published") || extractTag(block, "updated")
              : extractTag(block, "pubDate") || extractTag(block, "dc:date")

          if (!title || !link) continue
          const parsed = new Date(pubStr || Date.now())
          const publishedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed
          if (publishedAt < cutoff) continue
          if (!isAuditAiRelevant(title, desc)) continue
          if (seen.has(link)) continue
          seen.add(link)
          perFeedUrlCount.set(feed.url, n + 1)

          out.push({
            id: crypto.createHash("sha256").update(`rss:${link}`).digest("hex").slice(0, 24),
            title: title.slice(0, 300),
            url: link,
            source: feed.name,
            publishedAt: publishedAt.toISOString(),
            snippet: desc.slice(0, 800),
          })
        }
      } catch {
        // feed unavailable, skip
      }
    }),
  )

  return out
}

export async function fetchAllAuditAiItems(): Promise<AuditRawItem[]> {
  const items = await fetchAuditRssItems().catch(() => [] as AuditRawItem[])
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return items
}
