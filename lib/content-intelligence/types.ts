export type ContentPillar = "breaking" | "workplace" | "hacks" | "deep_dive" | "safety_trust"
export type ContentUrgency = "breaking" | "today" | "this_week" | "evergreen"
export type ContentStatus = "new" | "queued" | "filmed" | "skipped"

export type RawItem = {
  id: string
  title: string
  url: string
  source: string
  tier: 1 | 2 | 3 | 4 | 5
  publishedAt: string
  snippet: string
}

export type ClassifiedItem = RawItem & {
  pillar: ContentPillar
  urgency: ContentUrgency
  contentScore: number
  hook: string
  keyQuote?: string
  whyItMatters: string
  connectedTopics: string[]
  namedEntities: {
    people: string[]
    companies: string[]
    numbers: string[]
  }
}

export type ContentBriefing = {
  id: string
  generatedAt: string
  angle?: string
  summary: string
  topHook: string
  connections: string[]
  sections: {
    breaking: ClassifiedItem[]
    readyToFilm: ClassifiedItem[]
    watchList: ClassifiedItem[]
    deepDiveSeeds: ClassifiedItem[]
  }
}
