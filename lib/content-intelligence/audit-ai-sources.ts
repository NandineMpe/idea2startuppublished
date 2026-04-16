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
const MAX_ITEMS_PER_FEED = 12

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
  return {
    name: "Google News",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
  }
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

  // Industry + AI signals
  if (industry) queries.push(`${industry} AI technology`)
  if (vertical && vertical !== industry) queries.push(`${vertical} AI startup`)

  // Top keywords from context
  const topKeywords = keywords.slice(0, 4)
  for (const kw of topKeywords) {
    queries.push(`${kw} AI software`)
  }

  // Competitor moves
  for (const c of competitors.slice(0, 3)) {
    queries.push(`${c} news`)
  }

  // Company name signals
  if (companyName && companyName !== "My Company") {
    queries.push(`${companyName}`)
  }

  // Deduplicate and cap
  const unique = [...new Set(queries)].slice(0, 8)
  return unique.map(googleNewsRss)
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
          if (seen.has(link)) continue
          seen.add(link)
          perFeedCount.set(feed.url, n + 1)

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
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  const feeds = buildContextNewsQueries(params)
  const items = await fetchRssItems(feeds, cutoff).catch(() => [] as AuditRawItem[])
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  return items
}

// ── Legacy export kept so existing imports don't break ───────────────────────
/** @deprecated Use fetchContextualNewsItems with company context instead */
export async function fetchAllAuditAiItems(): Promise<AuditRawItem[]> {
  return fetchContextualNewsItems({
    companyName: "",
    industry: "technology",
    vertical: "SaaS",
    keywords: ["AI", "software", "automation"],
    competitors: [],
  })
}
