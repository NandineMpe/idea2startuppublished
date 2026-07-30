import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { loadResearchTopics, sweepSignalsForUser } from "@/lib/creator/research/sweep"

/**
 * The Researcher's standing remit: sweep sources every morning whether or not
 * anyone asked, then hand each user's fresh signals to the synthesis pass.
 * Also triggerable on demand for one user via the event.
 */
export const creatorResearchSweep = creatorInngest.createFunction(
  {
    id: "creator-research-sweep",
    name: "Creator OS: research sweep",
    retries: 2,
    triggers: [
      { cron: "0 6 * * *" },
      { event: "creator/research.sweep" },
    ],
  },
  async ({ event, step }) => {
    // Cron firings carry CronEventData; only the manual event carries our payload.
    const manual = event.name === "creator/research.sweep"
      ? (event.data as { user_id?: string; hours_back?: number })
      : undefined
    const requestedUserId = manual?.user_id
    const hoursBack = manual?.hours_back ?? 48

    const userIds = await step.run("resolve-users", async () => {
      if (requestedUserId) return [requestedUserId]
      // Standing remit covers everyone who has declared topics or has a canon.
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_settings")
        .select("user_id,niche_topics")
      if (error) throw error
      return (data ?? [])
        .filter((row) => Array.isArray(row.niche_topics) && row.niche_topics.length > 0)
        .map((row) => row.user_id as string)
    })

    const sweeps: Array<{ user_id: string; upserted: number; errors: string[] }> = []
    for (const userId of userIds) {
      const sweep = await step.run(`sweep-${userId}`, async () => {
        const topics = await loadResearchTopics(supabaseAdmin, userId)
        if (!topics.length) return null
        return sweepSignalsForUser(supabaseAdmin, userId, topics, hoursBack)
      })
      if (sweep) {
        sweeps.push({ user_id: userId, upserted: sweep.signals_upserted, errors: sweep.errors })
      }
    }

    // Fan out synthesis only for users whose sweep produced anything new.
    const toSynthesise = sweeps.filter((s) => s.upserted > 0)
    if (toSynthesise.length) {
      await step.sendEvent(
        "fan-out-synthesis",
        toSynthesise.map((s) => ({
          name: "creator/research.synthesise" as const,
          data: { user_id: s.user_id },
        })),
      )
    }

    return { users: userIds.length, sweeps }
  },
)
