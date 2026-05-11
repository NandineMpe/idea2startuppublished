import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { CAREEROS_FEED_USER_AGENT, pingFeedAdapter } from "@/lib/careeros/sources/feed-utils"

let lastArxivCallMs = 0

async function throttleArxiv() {
  const now = Date.now()
  const waitMs = Math.max(0, 3000 - (now - lastArxivCallMs))
  if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs))
  lastArxivCallMs = Date.now()
}

function parseArxivEntries(xml: string): Array<{
  id: string
  title: string
  summary: string
  published: Date
  authors: string[]
  link: string
}> {
  const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []
  return entries
    .map((e) => {
      const id = /<id>([\s\S]*?)<\/id>/i.exec(e)?.[1]?.trim() ?? ""
      const title = /<title>([\s\S]*?)<\/title>/i.exec(e)?.[1]?.replace(/\s+/g, " ").trim() ?? ""
      const summary = /<summary>([\s\S]*?)<\/summary>/i.exec(e)?.[1]?.replace(/\s+/g, " ").trim() ?? ""
      const pub = /<published>([\s\S]*?)<\/published>/i.exec(e)?.[1]?.trim() ?? ""
      const link = /<link[^>]*href="([^"]+)"/i.exec(e)?.[1]?.trim() ?? id
      const authors = [...e.matchAll(/<name>([\s\S]*?)<\/name>/gi)].map((m) => m[1].trim())
      const published = new Date(pub)
      if (!id || !title || Number.isNaN(published.getTime())) return null
      return { id, title, summary, published, authors, link }
    })
    .filter((x): x is { id: string; title: string; summary: string; published: Date; authors: string[]; link: string } => Boolean(x))
}

export async function fetchRecentArxivPapers(
  hoursBack = 36,
  categories: string[] = ["cs.AI", "cs.CL", "cs.LG", "cs.IR", "cs.MA"],
): Promise<RawFeedItem[]> {
  await throttleArxiv()
  const query = categories.map((c) => `cat:${c}`).join("+OR+")
  const url = `http://export.arxiv.org/api/query?search_query=${query}&start=0&max_results=200&sortBy=submittedDate&sortOrder=descending`
  const res = await fetch(url, {
    headers: { "User-Agent": CAREEROS_FEED_USER_AGENT },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`arXiv API returned ${res.status}`)
  const xml = await res.text()
  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000
  return parseArxivEntries(xml)
    .filter((p) => p.published.getTime() >= cutoff)
    .map((p) => ({
      source_key: "arxiv",
      source_item_id: p.id.replace(/^.*\/abs\//, ""),
      title: p.title,
      body: p.summary.slice(0, 5000),
      url: p.link,
      published_at: p.published,
      authors: p.authors,
      raw_payload: { id: p.id, categories, link: p.link },
    }))
}

export function pingArxivFeed() {
  return pingFeedAdapter((hoursBack) => fetchRecentArxivPapers(hoursBack))
}
