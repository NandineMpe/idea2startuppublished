import { getSourcesByCategory, getSourcesForAgent, type Source } from "./sources"
import type { JobListing, RawItem, ScrapedItem } from "./types"

export type { JobListing, RawItem } from "./types"

const MS_24H = 24 * 60 * 60 * 1000

/** Cutoff: items must be strictly newer than this (last 24 hours from now). */
export function cutoffMs24HoursAgo(): number {
  return Date.now() - MS_24H
}

/**
 * Keep items whose `publishedAt` parses to a time within the last 24 hours.
 * Drops missing/invalid dates (never treat unknown dates as "now").
 */
export function filterToLast24Hours(items: RawItem[]): RawItem[] {
  const min = cutoffMs24HoursAgo()
  return items.filter((item) => {
    const t = Date.parse(item.publishedAt)
    if (Number.isNaN(t)) return false
    return t >= min
  })
}

function publishedIso(raw: string | undefined): string {
  if (!raw?.trim()) return ""
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

// ─── Data Source Scrapers ────────────────────────────────────────

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

export function dedupeByUrl(items: RawItem[]): RawItem[] {
  const seen = new Set<string>()
  const out: RawItem[] = []
  for (const it of items) {
    const key = (it.url || "").trim() || `${it.source}:${it.title}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
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
    return filterToLast24Hours(parseArxivXml(xml))
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
        publishedAt: publishedIso(published),
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
        typeof s.time === "number" ? new Date(s.time * 1000).toISOString() : "",
      source: "hackernews",
      metadata: {
        score: (s as { score?: number }).score,
        comments: (s as { descendants?: number }).descendants,
      },
    })

    if (lowerKeywords.length === 0) {
      return filterToLast24Hours(withTitle.slice(0, 15).map(mapStory))
    }

    const filtered = withTitle.filter((s) => {
      const text = `${s.title} ${String((s as { text?: string }).text ?? "")}`.toLowerCase()
      return lowerKeywords.some((k) => text.includes(k))
    })

    const out = filtered.length > 0 ? filtered : withTitle.slice(0, 15)
    return filterToLast24Hours(out.map(mapStory))
  } catch (e) {
    console.error("HN scrape failed:", e)
    return []
  }
}

// ─── Generic RSS (registry-backed) ───────────────────────────────

/**
 * Parse RSS XML into RawItem[].
 * Handles both <item> (RSS 2.0) and <entry> (Atom) formats.
 */
function parseRSSFeedXml(xml: string, sourceName: string): RawItem[] {
  const items: RawItem[] = []

  const rssRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = rssRegex.exec(xml)) !== null) {
    const entry = match[1]
    const title = extractTag(entry, "title")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
    const link =
      extractTag(entry, "link")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ||
      extractTag(entry, "guid")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
    const desc = extractTag(entry, "description")
      ?.replace(/<!\[CDATA\[|\]\]>/g, "")
      .replace(/<[^>]*>/g, "")
      .trim()
    const pubDate = extractTag(entry, "pubDate")

    if (title) {
      const pubIso = pubDate ? publishedIso(pubDate) : ""
      items.push({
        title,
        description: desc?.substring(0, 500) || "",
        url: link || "",
        publishedAt: pubIso || new Date().toISOString(),
        source: sourceName,
      })
    }
  }

  if (items.length === 0) {
    const atomRegex = /<entry>([\s\S]*?)<\/entry>/gi
    while ((match = atomRegex.exec(xml)) !== null) {
      const entry = match[1]
      const title = extractTag(entry, "title")?.replace(/<!\[CDATA\[|\]\]>/g, "").trim()
      const linkMatch =
        entry.match(/<link[^>]+href="([^"]+)"[^>]*\/?>/i) ||
        entry.match(/<link[^>]*>([^<]*)<\/link>/i)
      const link = linkMatch?.[1]?.trim() || ""
      const desc =
        extractTag(entry, "summary")?.replace(/<[^>]*>/g, "").trim() ||
        extractTag(entry, "content")?.replace(/<[^>]*>/g, "").trim()
      const pubDate = extractTag(entry, "published") || extractTag(entry, "updated")

      if (title) {
        const pubIso = pubDate ? publishedIso(pubDate) : ""
        items.push({
          title,
          description: desc?.substring(0, 500) || "",
          url: link,
          publishedAt: pubIso || new Date().toISOString(),
          source: sourceName,
        })
      }
    }
  }

  return items
}

/**
 * Fetch and parse a single RSS feed.
 * Returns normalised RawItem[] with 24-hour cutoff applied.
 */
async function fetchRSS(source: Source): Promise<RawItem[]> {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": "Juno.ai/1.0" },
      signal: AbortSignal.timeout(12_000),
    })

    if (!res.ok) {
      console.warn(`[Scraper] ${source.name} returned ${res.status}`)
      return []
    }

    const xml = await res.text()
    const items = parseRSSFeedXml(xml, source.name)

    const min = cutoffMs24HoursAgo()
    return items.filter((item) => {
      const pubTime = Date.parse(item.publishedAt)
      if (Number.isNaN(pubTime)) return true
      return pubTime >= min
    })
  } catch (e) {
    console.warn(`[Scraper] ${source.name} failed:`, e)
    return []
  }
}

export async function scrapeCBSSources(keywords: string[], competitors: string[]): Promise<RawItem[]> {
  const cbsSources = getSourcesForAgent("cbs")

  const results = await Promise.all(cbsSources.map((source) => fetchRSS(source)))

  const allItems = results.flat()

  if (keywords.length === 0 && competitors.length === 0) {
    return allItems.slice(0, 50)
  }

  const lowerKeywords = [...keywords, ...competitors].map((k) => k.toLowerCase())
  const relevant = allItems.filter((item) => {
    const text = `${item.title} ${item.description}`.toLowerCase()
    return lowerKeywords.some((k) => text.includes(k))
  })

  if (relevant.length < 10) {
    const relUrls = new Set(relevant.map((r) => r.url))
    const extra = allItems
      .filter((item) => !relUrls.has(item.url))
      .slice(0, 10 - relevant.length)
    return [...relevant, ...extra].slice(0, 50)
  }

  return relevant.slice(0, 50)
}

export async function scrapeCTOSources(_keywords: string[]): Promise<RawItem[]> {
  const ctoSources = getSourcesForAgent("cto")

  const results = await Promise.all(ctoSources.map((source) => fetchRSS(source)))

  return results.flat().slice(0, 40)
}

export async function scrapeCROJobSources(keywords: string[]): Promise<RawItem[]> {
  const jobSources = getSourcesByCategory("jobs")

  const results = await Promise.all(jobSources.map((source) => fetchRSS(source)))

  const allJobs = results.flat()

  if (keywords.length === 0) return allJobs.slice(0, 30)

  const lowerKeywords = keywords.map((k) => k.toLowerCase())
  return allJobs
    .filter((item) => {
      const text = `${item.title} ${item.description}`.toLowerCase()
      return lowerKeywords.some((k) => text.includes(k))
    })
    .slice(0, 30)
}

// ─── Product Hunt (registry feed) ────────────────────────────────

export async function scrapeProductHunt(keywords: string[]): Promise<RawItem[]> {
  const ph = getSourcesForAgent("cbs").find((s) => s.name === "Product Hunt")
  if (!ph) return []
  try {
    const items = await fetchRSS(ph)
    if (keywords.length === 0) return items.slice(0, 10)
    const lowerKeywords = keywords.map((k) => k.toLowerCase())
    const filtered = items.filter((item) => {
      const t = `${item.title} ${item.description}`.toLowerCase()
      return lowerKeywords.some((k) => t.includes(k))
    })
    return (filtered.length > 0 ? filtered : items).slice(0, 10)
  } catch (e) {
    console.error("ProductHunt scrape failed:", e)
    return []
  }
}

// ─── News (legacy — delegates to CBS registry) ───────────────────

export async function scrapeNews(params: {
  competitors: string[]
  keywords: string[]
}): Promise<RawItem[]> {
  return scrapeCBSSources(params.keywords, params.competitors)
}

// ─── Regulation Monitor (RSS via registry) ─────────────────────────

export async function scrapeRegulation(): Promise<RawItem[]> {
  const feeds = getSourcesByCategory("regulation")
  const results = await Promise.all(feeds.map((s) => fetchRSS(s)))
  return results.flat()
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

function remotiveRssItemsToJobListings(items: RawItem[]): JobListing[] {
  return items.map((r) => ({
    company: r.title.split(/\s*[–—-]\s*/)[0]?.trim() || "Unknown",
    title: r.title.trim(),
    location: "Remote",
    description: r.description.slice(0, 3000),
    url: r.url,
    postedAt: r.publishedAt,
    source: "remotive-feed",
  }))
}

/** Curated rows that are J&J UI chrome (saved by mistake) — skip in CRO merge. */
function isJunkJackJillCuratedRow(company: string, title: string): boolean {
  const c = company.toLowerCase().trim()
  const t = title.toLowerCase().trim()
  if (/^(not for me|skip|interested|job post)$/.test(t) || /\bnot for me\b/.test(t)) return true
  if (/^(home|jobs|profile)$/.test(c) && (t === "not for me" || t === "skip")) return true
  return false
}

/** Curated jobs from Context (e.g. Jack & Jill digest) — merged first in CRO scan. */
export function jackJillRowsToJobListings(raw: unknown): JobListing[] {
  if (!Array.isArray(raw)) return []
  const out: JobListing[] = []
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue
    const r = x as Record<string, unknown>
    const company = String(r.company ?? "").trim()
    const title = String(r.title ?? "").trim()
    if (!company || !title) continue
    if (isJunkJackJillCuratedRow(company, title)) continue
    const urlRaw = typeof r.url === "string" ? r.url.trim() : ""
    const url =
      urlRaw.startsWith("http://") || urlRaw.startsWith("https://")
        ? urlRaw
        : `https://jack-jill.placeholder/listing#${encodeURIComponent(`${company}|${title}`)}`
    const description = typeof r.description === "string" ? r.description.trim().slice(0, 3000) : ""
    out.push({
      company,
      title,
      location: "—",
      description: description || `Curated listing (Jack & Jill) — ${company}`,
      url,
      postedAt: new Date().toISOString(),
      source: "jack_and_jill",
    })
  }
  return out
}

function dedupeJobListings(jobs: JobListing[]): JobListing[] {
  const seen = new Set<string>()
  const merged: JobListing[] = []
  for (const j of jobs) {
    const key = `${j.company.toLowerCase()}|${j.title.toLowerCase()}|${j.url}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(j)
  }
  return merged
}

/** Prefer `importedFirst` (Jack & Jill), then scraped boards. */
export function mergeJobListings(importedFirst: JobListing[], scraped: JobListing[]): JobListing[] {
  return dedupeJobListings([...importedFirst, ...scraped])
}

/**
 * Job boards — HN Who's Hiring (Algolia + Firebase) + Remotive API + Remotive RSS.
 * @param allowStub When false, returns [] if nothing found (use when Jack & Jill already supplied rows).
 */
export async function scrapeJobBoards(params: {
  keywords: string[]
  roles?: string[]
  allowStub?: boolean
}): Promise<JobListing[]> {
  const allowStub = params.allowStub !== false

  const [hnJobs, remotiveApi, rssJobs] = await Promise.all([
    scrapeHNJobs(params.keywords),
    scrapeRemotiveJobs(params.keywords, params.roles),
    scrapeCROJobSources(params.keywords).then(remotiveRssItemsToJobListings),
  ])

  const seen = new Set<string>()
  const merged: JobListing[] = []
  for (const j of [...hnJobs, ...remotiveApi, ...rssJobs]) {
    if (!seen.has(j.url)) {
      seen.add(j.url)
      merged.push(j)
    }
  }

  if (merged.length === 0 && allowStub) return stubJobListings()
  return merged.slice(0, 40)
}

/** Legacy stub for `fetchAllBriefSources` lane. */
export async function scrapeJobBoardsStub(): Promise<RawItem[]> {
  return []
}

/**
 * Legacy: arXiv + CBS RSS registry (single lane).
 */
export async function fetchAllBriefSources(arxivQuery?: string): Promise<ScrapedItem[]> {
  const [arxiv, cbs] = await Promise.all([
    scrapeArxiv(arxivQuery || "cat:cs.AI+OR+all:startup+funding").catch(() => []),
    scrapeCBSSources([], []).catch(() => []),
  ])
  return rawItemsToScrapedItems([...arxiv, ...cbs])
}
