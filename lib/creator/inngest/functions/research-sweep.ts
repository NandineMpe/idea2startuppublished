import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { loadResearchTopics, sweepOneTopic, sweepReleases } from "@/lib/creator/research/sweep"

/**
 * The Researcher's standing remit: sweep every register each morning whether or
 * not anyone asked, then hand the fresh signals to synthesis.
 *
 * Each topic gets its own step, and therefore its own execution window. The
 * first version swept all nine topics inside one step, which meant a single
 * slow source could exhaust the invocation and silently take every lane with
 * it — the failure looked like a quiet news day rather than a timeout.
 */
export const creatorResearchSweep = creatorInngest.createFunction(
  {
    id: "creator-research-sweep",
    name: "Creator OS: research sweep",
    retries: 2,
    triggers: [{ cron: "0 6 * * *" }, { event: "creator/research.sweep" }],
  },
  async ({ event, step }) => {
    const manual =
      event.name === "creator/research.sweep"
        ? (event.data as { user_id?: string; hours_back?: number })
        : undefined
    const requestedUserId = manual?.user_id
    const hoursBack = manual?.hours_back ?? 48

    const userIds = await step.run("resolve-users", async () => {
      if (requestedUserId) return [requestedUserId]

      // Declared niche topics OR a declared trajectory. Either is enough to
      // have something to search: once the trajectory drives the sweep, a
      // creator who clears their old niche topics must not silently drop out
      // of the cron.
      const [{ data: settings, error }, { data: trajectories }] = await Promise.all([
        supabaseAdmin.schema("creator").from("creator_settings").select("user_id,niche_topics"),
        supabaseAdmin.schema("creator").from("creator_trajectory").select("user_id,search_territory"),
      ])
      if (error) throw error

      const ids = new Set<string>()
      for (const row of settings ?? []) {
        if (Array.isArray(row.niche_topics) && row.niche_topics.length > 0) ids.add(row.user_id as string)
      }
      for (const row of trajectories ?? []) {
        if (Array.isArray(row.search_territory) && row.search_territory.length > 0) {
          ids.add(row.user_id as string)
        }
      }
      return [...ids]
    })

    const summaries: Array<{ user_id: string; upserted: number; errors: string[] }> = []

    for (const userId of userIds) {
      const topics = await step.run(`topics-${userId}`, async () => {
        return loadResearchTopics(supabaseAdmin, userId)
      })

      // Horizon first. If a run is going to be cut short, the territory the
      // creator is moving toward is the part worth protecting — core topics
      // already have a corpus behind them and will be back tomorrow.
      const plan = [
        ...topics.horizon.map((topic) => ({ topic, stance: "horizon" as const })),
        ...topics.core.map((topic) => ({ topic, stance: "core" as const })),
        ...topics.adjacent.map((topic) => ({ topic, stance: "adjacent" as const })),
      ]
      if (!plan.length) continue

      let upserted = 0
      const errors: string[] = []

      for (const [i, { topic, stance }] of plan.entries()) {
        const outcome = await step.run(`sweep-${userId}-${i}`, async () => {
          return sweepOneTopic(supabaseAdmin, userId, topic, stance, hoursBack)
        })
        upserted += outcome.upserted
        for (const err of outcome.errors) errors.push(`${topic} / ${err}`)
      }

      const releases = await step.run(`releases-${userId}`, async () => {
        return sweepReleases(supabaseAdmin, userId, hoursBack)
      })
      upserted += releases.upserted
      for (const err of releases.errors) errors.push(`releases / ${err}`)

      summaries.push({ user_id: userId, upserted, errors })
    }

    const toSynthesise = summaries.filter((s) => s.upserted > 0)
    if (toSynthesise.length) {
      await step.sendEvent(
        "fan-out-synthesis",
        toSynthesise.map((s) => ({
          name: "creator/research.synthesise" as const,
          data: { user_id: s.user_id },
        })),
      )
    }

    return { users: userIds.length, summaries }
  },
)
