import type { ClassifiedItem, ContentBriefing } from "@/lib/content-intelligence/types"
import { supabaseAdmin } from "@/lib/supabase"

export async function storeBriefing(userId: string, briefing: ContentBriefing) {
  const { error } = await supabaseAdmin.from("content_briefings").upsert(
    {
      id: briefing.id,
      user_id: userId,
      generated_at: briefing.generatedAt,
      angle: briefing.angle ?? null,
      summary: briefing.summary,
      top_hook: briefing.topHook,
      connections: briefing.connections,
      story_count:
        briefing.sections.breaking.length +
        briefing.sections.readyToFilm.length +
        briefing.sections.watchList.length +
        briefing.sections.deepDiveSeeds.length,
      breaking_count: briefing.sections.breaking.length,
    },
    { onConflict: "id" },
  )
  if (error) throw error
}

export async function storeStories(userId: string, briefingId: string, items: ClassifiedItem[]) {
  if (items.length === 0) return
  const rows = items.map((item) => ({
    id: `${userId}:${item.id}`,
    user_id: userId,
    briefing_id: briefingId,
    url: item.url,
    title: item.title,
    source: item.source,
    tier: item.tier,
    published_at: item.publishedAt,
    snippet: item.snippet,
    pillar: item.pillar,
    urgency: item.urgency,
    content_score: item.contentScore,
    hook: item.hook,
    key_quote: item.keyQuote ?? null,
    why_it_matters: item.whyItMatters,
    connected_topics: item.connectedTopics,
    named_people: item.namedEntities.people,
    named_companies: item.namedEntities.companies,
    named_numbers: item.namedEntities.numbers,
  }))
  const { error } = await supabaseAdmin.from("content_stories").upsert(rows, { onConflict: "user_id,url" })
  if (error) throw error
}
