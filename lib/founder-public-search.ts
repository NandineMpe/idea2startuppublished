/**
 * Free public sources for founder background (no paid search APIs).
 * Combines DuckDuckGo instant answers and Wikipedia extracts.
 */

export type FounderSearchSnippet = { text: string }

export async function searchFounderPublic(query: string): Promise<FounderSearchSnippet[]> {
  const results: FounderSearchSnippet[] = []
  const q = query.trim()
  if (!q) return []

  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { Accept: "application/json" } },
    )
    if (ddgRes.ok) {
      const ddg = (await ddgRes.json()) as {
        Abstract?: string
        AbstractText?: string
        RelatedTopics?: Array<{ Text?: string } | { Topics?: unknown }>
      }
      const abstract = ddg.Abstract?.trim() || ddg.AbstractText?.trim()
      if (abstract) results.push({ text: abstract })
      const related = ddg.RelatedTopics
      if (Array.isArray(related)) {
        for (const t of related.slice(0, 3)) {
          if (t && typeof t === "object" && "Text" in t && typeof (t as { Text?: string }).Text === "string") {
            const text = (t as { Text: string }).Text.trim()
            if (text) results.push({ text })
          }
        }
      }
    }
  } catch {
    // continue to Wikipedia
  }

  try {
    const wikiSearch = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json&origin=*`,
    )
    if (!wikiSearch.ok) return dedupeSnippets(results)

    const wikiData = (await wikiSearch.json()) as {
      query?: { search?: Array<{ title: string }> }
    }
    const hits = wikiData?.query?.search
    if (!hits?.length) return dedupeSnippets(results)

    for (const h of hits.slice(0, 2)) {
      const extractRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(h.title)}&format=json&origin=*`,
      )
      if (!extractRes.ok) continue
      const ex = (await extractRes.json()) as {
        query?: { pages?: Record<string, { extract?: string }> }
      }
      const pages = ex?.query?.pages
      if (!pages) continue
      const page = Object.values(pages)[0]
      const extract = page?.extract?.trim()
      if (extract) results.push({ text: `${h.title}: ${extract}` })
    }
  } catch {
    // ignore
  }

  return dedupeSnippets(results)
}

function dedupeSnippets(items: FounderSearchSnippet[]): FounderSearchSnippet[] {
  const seen = new Set<string>()
  const out: FounderSearchSnippet[] = []
  for (const item of items) {
    const key = item.text.slice(0, 200)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
