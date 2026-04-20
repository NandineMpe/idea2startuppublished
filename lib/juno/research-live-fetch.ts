import Exa from "exa-js"
import { fetchArxivSearchLive } from "@/lib/juno/scrapers"
import { snippetFromRawItem, type ResearchEvidenceSnippet } from "@/lib/juno/research-evidence"

const STOPWORDS = new Set([
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "where",
  "when",
  "why",
  "how",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "then",
  "than",
  "into",
  "for",
  "from",
  "with",
  "about",
  "against",
  "between",
  "through",
  "during",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "can",
  "could",
  "should",
  "would",
  "will",
  "just",
  "only",
  "very",
  "some",
  "any",
  "each",
  "every",
  "such",
  "also",
  "tell",
  "give",
  "get",
  "got",
  "like",
  "need",
  "want",
  "please",
])

function getExaClient(): Exa | null {
  const key = process.env.EXA_API?.trim() || process.env.EXA_API_KEY?.trim()
  if (!key) return null
  return new Exa(key)
}

/** Pull search tokens from the question plus a few founder keywords. */
export function termsForArxivSearch(question: string, boostKeywords: string[], maxTerms = 8): string[] {
  const boost = boostKeywords
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 1 && !STOPWORDS.has(k))
    .slice(0, 3)

  const raw = `${question} ${boost.join(" ")}`.toLowerCase()
  const tokens = raw.match(/[a-z0-9][a-z0-9._-]*/g) ?? []
  const out: string[] = []
  const seen = new Set<string>()

  for (const t of tokens) {
    if (t.length < 2 || STOPWORDS.has(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
    if (out.length >= maxTerms) break
  }

  return out
}

/** arXiv `search_query`: OR of `all:term` clauses (broad recall). */
export function buildArxivOrQuery(terms: string[]): string {
  if (terms.length === 0) return "cat:cs.AI+OR+cat:cs.LG"
  return terms.map((t) => `all:${encodeURIComponent(t)}`).join("+OR+")
}

export async function fetchLiveArxivSnippets(
  question: string,
  boostKeywords: string[],
  maxResults = 12,
): Promise<ResearchEvidenceSnippet[]> {
  const terms = termsForArxivSearch(question, boostKeywords)
  let query = buildArxivOrQuery(terms)
  let raw = await fetchArxivSearchLive(query, maxResults)

  if (raw.length === 0 && terms.length > 3) {
    query = buildArxivOrQuery(terms.slice(0, 3))
    raw = await fetchArxivSearchLive(query, maxResults)
  }

  if (raw.length === 0 && terms.length > 0) {
    query = `cat:cs.AI+AND+${buildArxivOrQuery(terms.slice(0, 2))}`
    raw = await fetchArxivSearchLive(query, maxResults)
  }

  const out: ResearchEvidenceSnippet[] = []
  const stamp = new Date().toISOString()
  for (const item of raw) {
    const s = snippetFromRawItem(item, "arxiv", `live_arxiv:${stamp}`)
    if (s) out.push(s)
  }
  return out
}

/** Optional: neural search biased toward papers and standards pages when `EXA_API` is set. */
export async function fetchLiveWebResearchSnippets(
  question: string,
  maxResults = 5,
): Promise<ResearchEvidenceSnippet[]> {
  const exa = getExaClient()
  if (!exa) return []

  const q = `${question.trim()} (paper OR preprint OR survey OR technical report OR specification standard documentation)`

  try {
    const res = await exa.searchAndContents(q, {
      numResults: maxResults,
      text: { maxCharacters: 4500 },
      type: "neural",
    })

    const stamp = new Date().toISOString()
    const out: ResearchEvidenceSnippet[] = []

    for (const r of res.results ?? []) {
      const url = typeof r.url === "string" ? r.url.trim() : ""
      const title = typeof r.title === "string" ? r.title.trim() : ""
      if (!url || !title) continue

      const text = typeof r.text === "string" ? r.text.trim().slice(0, 1200) : ""
      out.push({
        title,
        url,
        source: "web",
        description: text,
        publishedAt: "",
        relevanceScore: null,
        category: "research",
        whyItMatters: "",
        strategicImplication: "",
        briefRunAt: `live_web:${stamp}`,
      })
    }

    return out
  } catch (e) {
    console.warn("[research-live-fetch] Exa search failed:", e instanceof Error ? e.message : e)
    return []
  }
}
