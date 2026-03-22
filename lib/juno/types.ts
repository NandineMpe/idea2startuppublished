/** Raw item from any scraper (before scoring). */
export type ScrapedItem = {
  id: string
  source: string
  title: string
  summary: string
  url: string
}

export type ScoredItem = ScrapedItem & {
  score: number
  reason: string
}

export type DailyBriefPayload = {
  userId: string
  briefMarkdown: string
  scoredItems: ScoredItem[]
  generatedAt: string
}

export type LeadPayload = {
  userId: string
  company: string
  role: string
  sourceUrl?: string
  snippet?: string
}

export type EnrichedLeadPayload = LeadPayload & {
  enrichment: string
}
