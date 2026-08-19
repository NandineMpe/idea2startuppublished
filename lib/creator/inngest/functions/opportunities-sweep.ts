import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { loadResearchTopics } from "@/lib/creator/research/sweep"
import { sweepOpportunitiesForUser } from "@/lib/creator/opportunities/sweep"

/**
 * The partnerships desk: hunt for deals, events and marketplace listings,
 * pitches pre-drafted, everything gated behind the creator's approval.
 *
 * On request rather than on a schedule. This one has a deadline problem the
 * others do not: a speaking call that closed while nobody was looking is worse
 * than no result, so the pitch drafts state their own age and the sweep is run
 * when there is someone available to act on what it finds.
 */
export const creatorOpportunitiesSweep = creatorInngest.createFunction(
  {
    id: "creator-opportunities-sweep",
    name: "Creator OS: opportunities sweep",
    retries: 1,
    concurrency: { key: "event.data.user_id", limit: 1 },
    triggers: [{ event: "creator/opportunities.sweep" }],
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
        // Core and horizon, not adjacent. Adjacency is the canon's guess at a
        // nearby topic and is an editorial bet rather than something to pitch
        // on; the horizon is the creator's own declared destination, and the
        // stages that build it are the ones this desk kept failing to find.
        if (!topics.core.length && !topics.horizon.length) return null
        return sweepOpportunitiesForUser(supabaseAdmin, userId, topics.core, topics.horizon)
      })
      if (result) results.push({ user_id: userId, candidates: result.candidates, proposed: result.proposed })
    }

    return { users: userIds.length, results }
  },
)
