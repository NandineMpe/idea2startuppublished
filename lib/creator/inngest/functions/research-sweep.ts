import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { loadResearchTopics, sweepOneTopic, sweepReleases } from "@/lib/creator/research/sweep"
import { rebuildTasteForUser } from "@/lib/creator/taste/rebuild"
import { markIndustrySwept, planIndustrySweep } from "@/lib/creator/industry/sweep-plan"

/**
 * The Researcher: sweep every register, then hand the fresh signals to synthesis.
 *
 * Runs on request rather than on a schedule. It swept every morning until the
 * creator pointed out that she does not work here daily, and a desk that files
 * a fresh slate every morning to someone who visits fortnightly is not being
 * diligent, it is burying the good run under thirteen stale ones. Sweeping when
 * asked also means the corpus is fresh at the moment she is actually reading it.
 *
 * The all-users resolution below is kept deliberately. Nothing schedules it
 * today, but it is what an admin backfill or a restored schedule would use, and
 * a manual run always carries a user_id and takes the short path.
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
    triggers: [{ event: "creator/research.sweep" }],
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
      // of an all-users run.
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
      // Taste first, and inline rather than as a separate event.
      //
      // The Sunday-night rebuild used to guarantee that Monday's synthesis read
      // a current profile. With nothing scheduled, that ordering has to be made
      // here or it does not exist: every kill since the last sweep would be
      // invisible to the pass that decides what survives this one, and the desk
      // would keep proposing the thing she just binned. It is a count over one
      // table, so it costs nothing to do it in the right order.
      await step.run(`taste-${userId}`, async () => {
        const r = await rebuildTasteForUser(supabaseAdmin, userId)
        return { approvals: r.approve_count, kills: r.kill_count }
      })

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

      // Industries collect for themselves, a few per run.
      //
      // Without this the In industry screen is a list of headings: the sweep
      // reads her canon and her trajectory, both of which are about audit,
      // finance and law, so an industry outside that was being asked to build a
      // dossier from a corpus that had never looked for it. Rotated rather than
      // swept in full, because fourteen industries across twenty-two lanes is
      // not one execution window.
      const industries = await step.run(`industry-plan-${userId}`, async () =>
        planIndustrySweep(supabaseAdmin, userId),
      )

      for (const [i, industry] of industries.entries()) {
        for (const [j, query] of industry.queries.entries()) {
          const outcome = await step.run(`industry-${userId}-${i}-${j}`, async () =>
            sweepOneTopic(supabaseAdmin, userId, query, "industry", hoursBack),
          )
          upserted += outcome.upserted
          for (const err of outcome.errors) errors.push(`${industry.slug} / ${err}`)
        }
        // Marked after its queries have run, so a run that dies halfway leaves
        // the unfinished industry at the front of the rotation rather than
        // sending it to the back having collected nothing.
        await step.run(`industry-mark-${userId}-${i}`, async () => {
          await markIndustrySwept(supabaseAdmin, userId, industry.slug)
          return { slug: industry.slug }
        })
      }

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
