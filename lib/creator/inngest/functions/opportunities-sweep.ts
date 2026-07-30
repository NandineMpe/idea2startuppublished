import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { loadResearchTopics } from "@/lib/creator/research/sweep"
import { sweepOpportunitiesForUser } from "@/lib/creator/opportunities/sweep"

/**
 * The partnerships desk's standing remit: hunt for deals, events and
 * marketplace listings every morning, pitches pre-drafted, everything gated
 * behind the creator's approval on the Desk.
 */
export const creatorOpportunitiesSweep = creatorInngest.createFunction(
  {
    id: "creator-opportunities-sweep",
    name: "Creator OS: opportunities sweep",
    retries: 1,
    concurrency: { key: "event.data.user_id", limit: 1 },
    triggers: [
      { cron: "30 6 * * *" },
      { event: "creator/opportunities.sweep" },
    ],
  },
  async ({ event, step }) => {
    const manual = event.name === "creator/opportunities.sweep"
      ? (event.data as { user_id?: string })
      : undefined

    const userIds = await step.run("resolve-users", async () => {
      if (manual?.user_id) return [manual.user_id]
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_settings")
        .select("user_id,niche_topics")
      if (error) throw error
      return (data ?? [])
        .filter((row) => Array.isArray(row.niche_topics) && row.niche_topics.length > 0)
        .map((row) => row.user_id as string)
    })

    const results: Array<{ user_id: string; candidates: number; proposed: number }> = []
    for (const userId of userIds) {
      const result = await step.run(`sweep-${userId}`, async () => {
        const topics = await loadResearchTopics(supabaseAdmin, userId)
        // Brands buy the audience the creator already has, so deals are hunted
        // against core topics only — adjacency is an editorial bet, not a
        // credential to pitch on.
        if (!topics.core.length) return null
        return sweepOpportunitiesForUser(supabaseAdmin, userId, topics.core)
      })
      if (result) results.push({ user_id: userId, candidates: result.candidates, proposed: result.proposed })
    }

    return { users: userIds.length, results }
  },
)
