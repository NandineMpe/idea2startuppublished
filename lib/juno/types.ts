/** Raw item from any scraper (before scoring). */
export type ScrapedItem = {
  id: string
  source: string
  title: string
  summary: string
  url: string
}

/** Normalized shape for Claude scoring (maps from ScrapedItem). */
export type RawItem = {
  title: string
  description: string
  url: string
  source: string
  publishedAt: string
  metadata?: Record<string, unknown>
}

/** After Claude scores against full CompanyContext.promptBlock. */
export type ScoredItem = RawItem & {
  relevanceScore: number
  urgency: "breaking" | "today" | "this_week"
  category: "competitor" | "funding" | "regulation" | "research" | "tool" | "opportunity"
  whyItMatters: string
}

export type DailyBriefPayload = {
  userId: string
  briefMarkdown: string
  scoredItems: ScoredItem[]
  generatedAt: string
  /** CBS pipeline v2 */
  briefDate?: string
  itemCount?: number
  /** Alias for `scoredItems` (CMO content engine) */
  items?: ScoredItem[]
}

export type LeadPayload = {
  userId: string
  company: string
  role: string
  sourceUrl?: string
  snippet?: string
}

/** Emitted by CRO job scanner after ICP scoring (`juno/lead.discovered`). */
export type LeadDiscoveredPayload = {
  userId: string
  company: string
  role: string
  url: string
  score: number
  pitchAngle: string
  source?: string
}

/** Job listing row from `scrapeJobBoards`. */
export type JobListing = {
  company: string
  title: string
  location: string
  salary?: string
  description: string
  url: string
  postedAt: string
  source: string
}

/** Structured output from ai-engine scoreLeadFit — passed to outreach. */
export type LeadFitResult = {
  icpFit: number
  timing: "urgent" | "warm" | "cold"
  budgetSignal: "high" | "medium" | "low"
  pitchAngle: string
}

export type EnrichedLeadPayload = LeadPayload & {
  enrichment: string
  leadFit?: LeadFitResult
}
