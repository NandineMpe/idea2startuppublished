import type { JobListing, RawItem, ScrapedItem } from "./types"

export type { JobListing, RawItem } from "./types"

// ─── Data Source Scrapers ────────────────────────────────────────
// Real implementations where APIs exist, structured stubs where
// they need API keys. Each returns normalised RawItem[] (jobs: JobListing[]).
// ─────────────────────────────────────────────────────────────────

/** Map legacy `ScrapedItem` rows into `scoreItems` input. */
export function scrapedItemsToRawItems(items: ScrapedItem[]): RawItem[] {
  return items.map((s) => ({
    title: s.title,
    description: s.summary,
    url: s.url,
    source: s.source,
    publishedAt: "",
  }))
}

/** For `fetchAllBriefSources` — bridge RawItem → legacy ScrapedItem. */
export function rawItemsToScrapedItems(items: RawItem[]): ScrapedItem[] {
  return items.map((r, i) => ({
    id: `${r.source}:${i}:${r.url.slice(0, 48)}`,
    title: r.title,
    summary: r.description,
    url: r.url,
    source: r.source,
  }))
}

/** Build arXiv `search_query` from founder keywords (not hardcoded verticals). */
export function keywordsToArxivQuery(keywords: string[]): string {
  const k = keywords
    .filter(Boolean)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 8)
  if (k.length === 0) return "cat:cs.AI+OR+all:startup+funding"
  return k.map((term) => `all:"${encodeURIComponent(term)}"`).join("+OR+")
}

// ─── ArXiv (FREE, no API key) ────────────────────────────────────

export async function scrapeArxiv(
  keywordsOrLegacyQuery: string[] | string = "cat:cs.AI+OR+all:startup+funding",
  maxResults = 15,
): Promise<RawItem[]> {
  let searchQuery: string
  if (Array.isArray(keywordsOrLegacyQuery)) {
    const kw = keywordsOrLegacyQuery
      .filter(Boolean)
      .map((k) => k.trim())
      .slice(0, 5)
    searchQuery =
      kw.length === 0 ? "cat:cs.AI+OR+all:startup+funding" : keywordsToArxivQuery(kw)
  } else {
    searchQuery = keywordsOrLegacyQuery
  }

  const params = new URLSearchParams({
    search_query: searchQuery,
    start: "0",
    max_results: String(maxResults),
    sortBy: "submittedDate",
    sortOrder: "descending",
  })
  const url = `http://export.arxiv.org/api/query?${params.toString()}`

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25_000) })
    if (!response.ok) return []
    const xml = await response.text()
    return parseArxivXml(xml)
  } catch (e) {
    console.error("ArXiv scrape failed:", e)
    return []
  }
}

function parseArxivXml(xml: string): RawItem[] {
  const entries: RawItem[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]
    const title = extractTag(entry, "title")?.replace(/\s+/g, " ").trim()
    const summary = extractTag(entry, "summary")?.replace(/\s+/g, " ").trim()
    const id = extractTag(entry, "id")
    const published = extractTag(entry, "published")

    const authorRegex = /<author>\s*<name>(.*?)<\/name>/g
    const authors: string[] = []
    let authorMatch
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1])
    }

    const catRegex = /category[^>]*term="([^"]+)"/g
    const categories: string[] = []
    let catMatch
    while ((catMatch = catRegex.exec(entry)) !== null) {
      categories.push(catMatch[1])
    }

    const absUrl = id?.includes("arxiv.org") ? id : id ? `https://arxiv.org/abs/${id.split("/").pop() ?? ""}` : ""

    if (title && id) {
      entries.push({
        title,
        description: summary?.substring(0, 500) || "",
        url: absUrl,
        publishedAt: published || new Date().toISOString(),
        source: "arxiv",
        metadata: { authors: authors.slice(0, 5), categories },
      })
    }
  }

  return entries
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i")
  const m = regex.exec(xml)
  return m?.[1]?.trim()
}

// ─── Hacker News (FREE, no API key) ─────────────────────────────

export async function scrapeHackerNews(keywords: string[]): Promise<RawItem[]> {
  try {
    const topRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json", {
      signal: AbortSignal.timeout(10_000),
    })
    if (!topRes.ok) return []
    const topIds: number[] = await topRes.json()

    const stories = await Promise.all(
      topIds.slice(0, 30).map(async (id) => {
        try {
          const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
            signal: AbortSignal.timeout(5000),
          })
          return res.json()
        } catch {
          return null
        }
      }),
    )

    const lowerKeywords = keywords.map((k) => k.toLowerCase()).filter(Boolean)

    const withTitle = stories.filter(
      (s): s is Record<string, unknown> & { title: string; id: number; time?: number } =>
        s !== null && typeof (s as { title?: string }).title === "string",
    )

    const mapStory = (s: Record<string, unknown> & { title: string; id: number; time?: number }): RawItem => ({
      title: s.title,
      description: String((s as { text?: string }).text ?? "").substring(0, 500),
      url: (s as { url?: string }).url || `https://news.ycombinator.com/item?id=${s.id}`,
      publishedAt:
        typeof s.time === "number" ? new Date(s.time * 1000).toISOString() : new Date().toISOString(),
      source: "hackernews",
      metadata: {
        score: (s as { score?: number }).score,
        comments: (s as { descendants?: number }).descendants,
      },
    })

    if (lowerKeywords.length === 0) {
      return withTitle.slice(0, 15).map(mapStory)
    }

    const filtered = withTitle.filter((s) => {
      const text = `${s.title} ${String((s as { text?: string }).text ?? "")}`.toLowerCase()
      return lowerKeywords.some((k) => text.includes(k))
    })

    const out = filtered.length > 0 ? filtered : withTitle.slice(0, 15)
    return out.map(mapStory)
  } catch (e) {
    console.error("HN scrape failed:", e)
    return []
  }
}

// ─── Product Hunt (FREE — public feed) ───────────────────────────

export async function scrapeProductHunt(keywords: string[]): Promise<RawItem[]> {
  try {
    const res = await fetch("https://www.producthunt.com/feed?category=undefined", {
      headers: { "User-Agent": "Juno.ai/1.0" },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return []
    const text = await res.text()

    const items: RawItem[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match

    while ((match = itemRegex.exec(text)) !== null) {
      const entry = match[1]
      const title = extractTag(entry, "title")
      const link = extractTag(entry, "link")
      const desc = extractTag(entry, "description")
      const pubDate = extractTag(entry, "pubDate")

      if (title) {
        items.push({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, ""),
          description: desc?.replace(/<[^>]*>/g, "").substring(0, 500) || "",
          url: link || "",
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          source: "producthunt",
        })
      }
    }

    if (items.length > 0 && keywords.length > 0) {
      const lowerKeywords = keywords.map((k) => k.toLowerCase())
      const filtered = items.filter((item) => {
        const t = `${item.title} ${item.description}`.toLowerCase()
        return lowerKeywords.some((k) => t.includes(k))
      })
      return (filtered.length > 0 ? filtered : items).slice(0, 10)
    }

    return items.slice(0, 10)
  } catch (e) {
    console.error("ProductHunt scrape failed:", e)
    return []
  }
}

// ─── News via RSS feeds (FREE) ───────────────────────────────────

const NEWS_FEEDS = [
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", name: "TechCrunch AI" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", name: "The Verge AI" },
  { url: "https://blog.google/technology/ai/rss/", name: "Google AI Blog" },
]

export async function scrapeNews(params: {
  competitors: string[]
  keywords: string[]
}): Promise<RawItem[]> {
  const allItems: RawItem[] = []

  await Promise.all(
    NEWS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "Juno.ai/1.0" },
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) return
        const xml = await res.text()
        allItems.push(...parseRssItems(xml, feed.name))
      } catch (e) {
        console.error(`RSS fetch failed for ${feed.name}:`, e)
      }
    }),
  )

  const cutoff = Date.now() - 48 * 60 * 60 * 1000
  const recent = allItems.filter((item) => new Date(item.publishedAt).getTime() > cutoff)

  const lowerKeywords = [...params.keywords, ...params.competitors].map((k) => k.toLowerCase())

  if (lowerKeywords.length === 0) return recent.slice(0, 20)

  const relevant = recent.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase()
    return lowerKeywords.some((k) => text.includes(k))
  })

  return relevant.length > 0 ? relevant : recent.slice(0, 10)
}

function parseRssItems(xml: string, sourceName: string): RawItem[] {
  const out: RawItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let im: RegExpExecArray | null
  while ((im = itemRegex.exec(xml)) !== null) {
    const entry = im[1]
    const title = extractTag(entry, "title")?.replace(/<!\[CDATA\[|\]\]>/g, "")
    const link = extractTag(entry, "link")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
    const desc = extractTag(entry, "description")?.replace(/<[^>]*>/g, "")
    const pubDate = extractTag(entry, "pubDate")
    if (title) {
      out.push({
        title,
        description: desc?.substring(0, 500) || "",
        url: link || "",
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        source: sourceName,
      })
    }
  }

  // Atom (e.g. some Google feeds)
  if (out.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi
    let em: RegExpExecArray | null
    while ((em = entryRegex.exec(xml)) !== null) {
      const entry = em[1]
      const title = extractTag(entry, "title")?.replace(/<!\[CDATA\[|\]\]>/g, "")
      const link =
        extractTag(entry, "link") ||
        entry.match(/<link[^>]+href="([^"]+)"/i)?.[1] ||
        ""
      const summary =
        extractTag(entry, "summary") || extractTag(entry, "content") || extractTag(entry, "subtitle")
      const updated = extractTag(entry, "updated") || extractTag(entry, "published")
      const cleaned = summary?.replace(/<[^>]*>/g, "") || ""
      if (title) {
        out.push({
          title,
          description: cleaned.substring(0, 500),
          url: link.trim(),
          publishedAt: updated ? new Date(updated).toISOString() : new Date().toISOString(),
          source: sourceName,
        })
      }
    }
  }

  return out
}

// ─── Regulation Monitor (RSS) ────────────────────────────────────

const REG_FEEDS = [{ url: "https://artificialintelligenceact.eu/feed/", name: "EU AI Act" }]

export async function scrapeRegulation(): Promise<RawItem[]> {
  const items: RawItem[] = []

  for (const feed of REG_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Juno.ai/1.0" },
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      items.push(...parseRssItems(xml, feed.name))
    } catch (e) {
      console.error(`Regulation feed failed for ${feed.name}:`, e)
    }
  }

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  return items.filter((i) => new Date(i.publishedAt).getTime() > cutoff)
}

// ─── Crunchbase (stub — needs API key) ───────────────────────────

export async function scrapeCrunchbaseStub(): Promise<RawItem[]> {
  return []
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function stubJobListings(): JobListing[] {
  return [
    {
      company: "Example Labs",
      title: "Controller",
      location: "Remote",
      description:
        "Stub listing — wire more job sources or expand Remotive queries. Finance team scaling, systems migration.",
      url: "https://example.com/jobs/controller",
      postedAt: new Date().toISOString(),
      source: "stub",
    },
  ]
}

async function scrapeRemotiveJobs(keywords: string[], roles?: string[]): Promise<JobListing[]> {
  const q =
    [keywords.join(" "), ...(roles ?? [])].filter(Boolean).join(" ").trim() || "software startup"
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as {
      jobs?: Array<{
        company_name?: string
        title?: string
        candidate_required_location?: string
        salary?: string
        description?: string
        publication_date?: string
        url?: string
      }>
    }
    const jobs = data.jobs ?? []
    return jobs.slice(0, 25).map((j) => ({
      company: j.company_name || "Unknown",
      title: j.title || "Open role",
      location: j.candidate_required_location || "Remote",
      salary: j.salary,
      description: stripHtml(j.description || "").slice(0, 3000),
      url: j.url || "https://remotive.com/remote-jobs",
      postedAt: j.publication_date || new Date().toISOString(),
      source: "remotive",
    }))
  } catch {
    return []
  }
}

async function scrapeHNJobs(keywords: string[]): Promise<JobListing[]> {
  try {
    const searchRes = await fetch(
      `https://hn.algolia.com/api/v1/search?query="who is hiring"&tags=story&hitsPerPage=1`,
      { signal: AbortSignal.timeout(10_000) },
    )
    const searchData = (await searchRes.json()) as { hits?: Array<{ objectID?: string }> }
    const threadId = searchData.hits?.[0]?.objectID
    if (!threadId) return []

    const threadRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${threadId}.json`, {
      signal: AbortSignal.timeout(10_000),
    })
    const thread = (await threadRes.json()) as { kids?: number[] } | null
    const kidIds = thread?.kids ?? []
    const limited = kidIds.slice(0, 200)

    const comments = await Promise.all(
      limited.map(async (id) => {
        try {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
            signal: AbortSignal.timeout(5000),
          })
          return r.json()
        } catch {
          return null
        }
      }),
    )

    const lowerKeywords = keywords.map((k) => k.toLowerCase()).filter(Boolean)

    const withText = comments.filter(
      (c): c is { id: number; text: string; time?: number } =>
        c !== null && typeof (c as { text?: string }).text === "string",
    )

    const filtered =
      lowerKeywords.length === 0
        ? withText
        : withText.filter((c) => {
            const text = stripHtml(c.text).toLowerCase()
            return lowerKeywords.some((k) => text.includes(k))
          })

    return filtered.slice(0, 20).map((c) => {
      const text = stripHtml(c.text)
      const firstLine = text.split("\n")[0] || ""
      const companyMatch = firstLine.match(/^([^|]+)/)
      return {
        company: companyMatch?.[1]?.trim().substring(0, 100) || "Unknown",
        title: extractJobTitle(text) || "See listing",
        location: extractLocation(text) || "Unknown",
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        description: text.substring(0, 800),
        postedAt: c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString(),
        source: "hackernews-hiring",
      }
    })
  } catch (e) {
    console.error("HN Jobs scrape failed:", e)
    return []
  }
}

function extractJobTitle(text: string): string {
  const patterns = [
    /(?:hiring|looking for|seeking)\s+(?:a\s+)?([^.|\n]{5,60})/i,
    /(?:role|position):\s*([^.|\n]{5,60})/i,
  ]
  for (const p of patterns) {
    const match = text.match(p)
    if (match) return match[1].trim()
  }
  return ""
}

function extractLocation(text: string): string {
  const patterns = [/(?:remote|onsite|hybrid)/i, /(?:San Francisco|New York|London|Berlin|Dublin|NYC|SF|LA)/i]
  for (const p of patterns) {
    const match = text.match(p)
    if (match) return match[0]
  }
  return ""
}

/**
 * Job boards — HN Who's Hiring (Algolia + Firebase) + Remotive.
 * Extend with LinkedIn/Indeed when API keys exist.
 */
export async function scrapeJobBoards(params: {
  keywords: string[]
  roles?: string[]
}): Promise<JobListing[]> {
  const [hnJobs, remotive] = await Promise.all([
    scrapeHNJobs(params.keywords),
    scrapeRemotiveJobs(params.keywords, params.roles),
  ])

  const seen = new Set<string>()
  const merged: JobListing[] = []
  for (const j of [...hnJobs, ...remotive]) {
    if (!seen.has(j.url)) {
      seen.add(j.url)
      merged.push(j)
    }
  }

  if (merged.length === 0) return stubJobListings()
  return merged.slice(0, 40)
}

/** Legacy stub for `fetchAllBriefSources` lane. */
export async function scrapeJobBoardsStub(): Promise<RawItem[]> {
  return []
}

/**
 * Legacy: single arXiv query + stubs (kept for older callers).
 */
export async function fetchAllBriefSources(arxivQuery?: string): Promise<ScrapedItem[]> {
  const [arxiv, rss, ph, crunch, jobs] = await Promise.all([
    scrapeArxiv(arxivQuery || "cat:cs.AI+OR+all:startup+funding").catch(() => []),
    scrapeNews({ competitors: [], keywords: [] }).catch(() => []),
    scrapeProductHunt([]),
    scrapeCrunchbaseStub(),
    scrapeJobBoardsStub(),
  ])
  return rawItemsToScrapedItems([...arxiv, ...rss, ...ph, ...crunch, ...jobs])
}
