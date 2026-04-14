import crypto from "node:crypto"
import { fetchTwitterAiTechRawItems } from "@/lib/content-intelligence/twitter-ai-raw"
import type { RawItem } from "@/lib/content-intelligence/types"

type RssSource = {
  source: string
  url: string
  tier: 1 | 2 | 3 | 4 | 5
}

const TIER1_RSS: RssSource[] = [
  { source: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", tier: 1 },
  { source: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", tier: 1 },
  { source: "Google DeepMind Blog", url: "https://deepmind.google/blog/rss.xml", tier: 1 },
  { source: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/", tier: 1 },
  { source: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", tier: 1 },
  { source: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/", tier: 1 },
  { source: "WIRED AI", url: "https://www.wired.com/feed/tag/ai/latest/rss", tier: 1 },
  { source: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", tier: 1 },
  {
    source: "a16z Speedrun",
    url: "https://speedrun.substack.com/feed",
    tier: 1,
  },
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", tier: 1 },
  { source: "HN AI", url: "https://hnrss.org/newest?q=AI", tier: 1 },
]

// B2B sales, CFO, and startup go-to-market intelligence sources
const B2B_SALES_RSS: RssSource[] = [
  { source: "Sales Hacker", url: "https://www.saleshacker.com/feed/", tier: 2 },
  { source: "HN B2B Sales", url: "https://hnrss.org/newest?q=B2B+sales", tier: 2 },
  { source: "HN Cold Email", url: "https://hnrss.org/newest?q=cold+email+outreach", tier: 2 },
  { source: "HN Sales Demo", url: "https://hnrss.org/newest?q=sales+demo", tier: 2 },
  { source: "HN CFO", url: "https://hnrss.org/newest?q=CFO+finance+SaaS", tier: 2 },
  { source: "TechCrunch Startups", url: "https://techcrunch.com/category/startups/feed/", tier: 2 },
  { source: "First Round Review", url: "https://review.firstround.com/feed.xml", tier: 2 },
  { source: "OpenView Partners", url: "https://openviewpartners.com/blog/feed/", tier: 2 },
]

// Reddit JSON feeds for B2B sales, CFO communities, and startup GTM conversations
const B2B_REDDIT_SOURCES: Array<{ subreddit: string; label: string; tier: 1 | 2 | 3 | 4 | 5 }> = [
  { subreddit: "sales", label: "r/sales", tier: 2 },
  { subreddit: "b2bsales", label: "r/b2bsales", tier: 2 },
  { subreddit: "CFO", label: "r/CFO", tier: 2 },
  { subreddit: "startups", label: "r/startups", tier: 2 },
  { subreddit: "Entrepreneur", label: "r/Entrepreneur", tier: 3 },
  { subreddit: "saas", label: "r/SaaS", tier: 2 },
]

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function decodeXml(input: string): string {
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
  return decodeXml(stripHtml(extractTag(entry, "link")))
}

function parseRssItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  return itemBlocks.map((item) => ({
    title: decodeXml(stripHtml(extractTag(item, "title"))),
    link: decodeXml(stripHtml(extractTag(item, "link"))),
    description: decodeXml(stripHtml(extractTag(item, "description") || extractTag(item, "content:encoded"))),
    pubDate: extractTag(item, "pubDate") || extractTag(item, "dc:date"),
  }))
}

function parseAtomEntries(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  return entryBlocks.map((entry) => ({
    title: decodeXml(stripHtml(extractTag(entry, "title"))),
    link: decodeXml(stripHtml(extractAtomLink(entry))),
    description: decodeXml(
      stripHtml(extractTag(entry, "summary") || extractTag(entry, "content") || extractTag(entry, "subtitle")),
    ),
    pubDate: extractTag(entry, "published") || extractTag(entry, "updated") || extractTag(entry, "dc:date"),
  }))
}

function toRawItem(source: RssSource, item: { title: string; link: string; description: string; pubDate: string }): RawItem | null {
  if (!item.title || !item.link) return null
  const parsed = new Date(item.pubDate || Date.now())
  const publishedAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)
  if (ageHours > 168) return null
  return {
    id: crypto.createHash("sha256").update(item.link).digest("hex").slice(0, 24),
    title: item.title.slice(0, 240),
    url: item.link,
    source: source.source,
    tier: source.tier,
    publishedAt: publishedAt.toISOString(),
    snippet: item.description.slice(0, 500),
  }
}

async function fetchRssSource(source: RssSource): Promise<RawItem[]> {
  try {
    const res = await fetch(source.url, { headers: { "User-Agent": "JunoContentFeed/1.0" } })
    if (!res.ok) return []
    const xml = await res.text()
    const parsed = xml.includes("<entry") ? parseAtomEntries(xml) : parseRssItems(xml)
    return parsed
      .map((item) => toRawItem(source, item))
      .filter((item): item is RawItem => Boolean(item))
  } catch {
    return []
  }
}

async function fetchRedditB2BItems(): Promise<RawItem[]> {
  const results = await Promise.all(
    B2B_REDDIT_SOURCES.map(async ({ subreddit, label, tier }) => {
      try {
        // Use Reddit's .json endpoint sorted by hot to surface active discussions
        const res = await fetch(
          `https://www.reddit.com/r/${subreddit}/hot.json?limit=15`,
          {
            headers: {
              "User-Agent": "JunoB2BFeed/1.0 (sales intelligence)",
              Accept: "application/json",
            },
          },
        )
        if (!res.ok) return [] as RawItem[]
        const data = await res.json()
        const posts = data?.data?.children ?? []
        return (posts as Array<{ data: Record<string, unknown> }>)
          .map(({ data: post }) => {
            const title = String(post.title ?? "").trim().slice(0, 240)
            const url = post.url
              ? String(post.url).trim()
              : `https://www.reddit.com${String(post.permalink ?? "").trim()}`
            const permalink = `https://www.reddit.com${String(post.permalink ?? "").trim()}`
            const selftext = String(post.selftext ?? "").trim().slice(0, 500)
            const createdUtc = typeof post.created_utc === "number" ? post.created_utc : Date.now() / 1000
            const publishedAt = new Date(createdUtc * 1000)
            const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)
            if (!title || ageHours > 168) return null
            const score = typeof post.score === "number" ? post.score : 0
            // Only surface posts with meaningful engagement
            if (score < 5) return null
            return {
              id: crypto.createHash("sha256").update(permalink).digest("hex").slice(0, 24),
              title,
              // Link back to Reddit discussion (more useful than outbound link for sales signals)
              url: permalink,
              source: label,
              tier,
              publishedAt: publishedAt.toISOString(),
              snippet: selftext || `Reddit discussion in ${label} — ${score} upvotes`,
            } satisfies RawItem
          })
          .filter((item): item is RawItem => Boolean(item))
      } catch {
        return [] as RawItem[]
      }
    }),
  )
  return results.flat()
}

export async function fetchTier1Sources(): Promise<RawItem[]> {
  const [tier1Results, b2bRssResults, twitterItems, redditB2BItems] = await Promise.all([
    Promise.all(TIER1_RSS.map(fetchRssSource)),
    Promise.all(B2B_SALES_RSS.map(fetchRssSource)),
    fetchTwitterAiTechRawItems().catch(() => [] as RawItem[]),
    fetchRedditB2BItems().catch(() => [] as RawItem[]),
  ])

  const results = [...tier1Results, ...b2bRssResults, twitterItems, redditB2BItems]
  const unique = new Map<string, RawItem>()
  for (const item of results.flat()) {
    if (!unique.has(item.url)) unique.set(item.url, item)
  }
  const bySource = new Map<string, RawItem[]>()
  for (const item of unique.values()) {
    if (!bySource.has(item.source)) bySource.set(item.source, [])
    bySource.get(item.source)!.push(item)
  }
  const limited: RawItem[] = []
  for (const items of bySource.values()) {
    items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    limited.push(...items.slice(0, 6))
  }
  return limited.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
