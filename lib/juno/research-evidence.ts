import type { ScoredItem } from "@/lib/juno/types"

/** Normalized row passed to the research Q&A prompt. */
export type ResearchEvidenceSnippet = {
  title: string
  url: string
  source: string
  description: string
  publishedAt: string
  relevanceScore: number | null
  category: string
  whyItMatters: string
  strategicImplication: string
  briefRunAt: string
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v)
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim()) {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

/** Coerce a loosely-typed JSON row into `ScoredItem`-like fields. */
export function coerceScoredItemFromDb(row: unknown): ScoredItem | null {
  if (!isRecord(row)) return null
  const title = str(row.title)
  const url = str(row.url)
  if (!title || !url) return null

  const relevanceScore =
    numOrNull(row.relevanceScore) ?? numOrNull(row.relevance_score) ?? numOrNull(row.score) ?? 0

  const categoryRaw = str(row.category)
  const category =
    categoryRaw === "competitor" ||
    categoryRaw === "funding" ||
    categoryRaw === "regulation" ||
    categoryRaw === "research" ||
    categoryRaw === "tool" ||
    categoryRaw === "opportunity"
      ? categoryRaw
      : "opportunity"

  const urgencyRaw = str(row.urgency)
  const urgency =
    urgencyRaw === "breaking" || urgencyRaw === "today" || urgencyRaw === "this_week"
      ? urgencyRaw
      : "this_week"

  return {
    title,
    description: str(row.description),
    url,
    source: str(row.source) || "unknown",
    publishedAt: str(row.publishedAt) || str(row.published_at) || "",
    relevanceScore,
    urgency,
    category,
    whyItMatters: str(row.whyItMatters) || str(row.why_it_matters) || "",
    strategicImplication: str(row.strategicImplication) || str(row.strategic_implication) || "",
    suggestedAction: str(row.suggestedAction) || str(row.suggested_action) || "",
    connectionToRoadmap:
      row.connectionToRoadmap === null || row.connectionToRoadmap === undefined
        ? null
        : str(row.connectionToRoadmap) || str(row.connection_to_roadmap) || null,
  }
}

export function parseScoredItemsFromInputs(inputs: unknown): ScoredItem[] {
  if (!isRecord(inputs)) return []
  const raw = inputs.scored_items ?? inputs.scoredItems
  if (!Array.isArray(raw)) return []
  const out: ScoredItem[] = []
  for (const el of raw) {
    const item = coerceScoredItemFromDb(el)
    if (item) out.push(item)
  }
  return out
}

function isResearchLikeItem(item: ScoredItem): boolean {
  if (item.category === "research") return true
  const src = item.source.toLowerCase()
  if (src.includes("arxiv")) return true
  const u = item.url.toLowerCase()
  if (u.includes("arxiv.org")) return true
  if (/(doi\.org|semanticscholar|openreview|aclweb|proceedings|\.pdf)/.test(u)) return true
  return false
}

export function snippetsFromBriefRows(
  rows: Array<{ created_at: string; inputs: unknown }>,
  maxItems: number,
): ResearchEvidenceSnippet[] {
  const byUrl = new Map<string, ResearchEvidenceSnippet>()

  for (const row of rows) {
    const items = parseScoredItemsFromInputs(row.inputs)
    for (const item of items) {
      if (!isResearchLikeItem(item)) continue
      const url = item.url.trim()
      if (!url) continue
      if (byUrl.has(url)) continue
      byUrl.set(url, {
        title: item.title,
        url,
        source: item.source,
        description: item.description.slice(0, 600),
        publishedAt: item.publishedAt,
        relevanceScore: Number.isFinite(item.relevanceScore) ? item.relevanceScore : null,
        category: item.category,
        whyItMatters: item.whyItMatters.slice(0, 500),
        strategicImplication: item.strategicImplication.slice(0, 500),
        briefRunAt: row.created_at,
      })
      if (byUrl.size >= maxItems) return [...byUrl.values()]
    }
  }

  return [...byUrl.values()]
}
