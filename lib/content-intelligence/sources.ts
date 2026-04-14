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
  { source: "Ars Technica", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", tier: 1 },
  { source: "HN AI", url: "https://hnrss.org/newest?q=AI", tier: 1 },
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

export async function fetchTier1Sources(): Promise<RawItem[]> {
  const [rssResults, twitterItems] = await Promise.all([
    Promise.all(
      TIER1_RSS.map(async (source) => {
        try {
          const res = await fetch(source.url, { headers: { "User-Agent": "JunoContentFeed/1.0" } })
          if (!res.ok) return [] as RawItem[]
          const xml = await res.text()
          const parsed = xml.includes("<entry") ? parseAtomEntries(xml) : parseRssItems(xml)
          return parsed
            .map((item) => toRawItem(source, item))
            .filter((item): item is RawItem => Boolean(item))
        } catch {
          return [] as RawItem[]
        }
      }),
    ),
    fetchTwitterAiTechRawItems().catch(() => [] as RawItem[]),
  ])

  const results = [...rssResults, twitterItems]
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
