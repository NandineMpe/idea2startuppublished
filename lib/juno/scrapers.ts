import type { ScrapedItem } from "./types"

/** arXiv Atom API — no API key. https://arxiv.org/help/api/user-manual */
export async function scrapeArxiv(searchQuery = "cat:cs.AI+OR+all:startup+funding", maxResults = 5): Promise<ScrapedItem[]> {
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
  if (!res.ok) return []
  const xml = await res.text()
  return parseArxivAtom(xml)
}

function parseArxivAtom(xml: string): ScrapedItem[] {
  const items: ScrapedItem[] = []
  const entryChunks = xml.split("<entry>").slice(1)
  for (let i = 0; i < entryChunks.length; i++) {
    const chunk = entryChunks[i]
    const id = extractTag(chunk, "id") || `arxiv-entry-${i}`
    const title = cleanText(extractTag(chunk, "title"))
    const summary = cleanText(extractTag(chunk, "summary"))
    const link = extractLinkHref(chunk)
    if (!title) continue
    items.push({
      id: `arxiv:${id}`,
      source: "arxiv",
      title,
      summary: summary.slice(0, 1200),
      url: link || `https://arxiv.org/abs/${id.split("/").pop() ?? ""}`,
    })
  }
  return items
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
  const m = xml.match(re)
  return m?.[1]?.trim() ?? ""
}

function extractLinkHref(xml: string): string {
  const m = xml.match(/<link[^>]*href="([^"]+)"/i)
  return m?.[1] ?? ""
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/** Stub: broad news / RSS — implement fetch + parse (rss-parser) next. */
export async function scrapeNewsRssStub(): Promise<ScrapedItem[]> {
  return []
}

/** Stub: Product Hunt — needs API. */
export async function scrapeProductHuntStub(): Promise<ScrapedItem[]> {
  return []
}

/** Stub: Crunchbase — needs API key. */
export async function scrapeCrunchbaseStub(): Promise<ScrapedItem[]> {
  return []
}

/** Stub: generic job board — implement job-boards.ts next. */
export async function scrapeJobBoardsStub(): Promise<ScrapedItem[]> {
  return []
}

/**
 * Fetch up to 5 “lanes” of signal. ArXiv is real; others are stubs until wired.
 */
export async function fetchAllBriefSources(arxivQuery?: string): Promise<ScrapedItem[]> {
  const [arxiv, rss, ph, crunch, jobs] = await Promise.all([
    scrapeArxiv(arxivQuery).catch(() => []),
    scrapeNewsRssStub(),
    scrapeProductHuntStub(),
    scrapeCrunchbaseStub(),
    scrapeJobBoardsStub(),
  ])
  return [...arxiv, ...rss, ...ph, ...crunch, ...jobs]
}
