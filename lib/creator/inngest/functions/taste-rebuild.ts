import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { rebuildTasteForUser } from "@/lib/creator/taste/rebuild"

/**
 * Roll decisions into a taste profile, weekly.
 *
 * Weekly rather than on every decision, even though this is only counting. A
 * profile that moves after each kill makes the desk twitchy: one irritated
 * evening spent binning five stories would rewrite what the researcher believes
 * about the creator, and it would take another five to argue it back. A week is
 * long enough that a bad night averages out and short enough that a genuine
 * change of direction is picked up before the next fortnight's slate.
 *
 * Sunday night, so Monday's sweep is the first to read it.
 */
export const creatorTasteRebuild = creatorInngest.createFunction(
  {
    id: "creator-taste-rebuild",
    name: "Creator OS: rebuild taste profiles",
    retries: 1,
    triggers: [{ cron: "0 22 * * 0" }, { event: "creator/taste.rebuild" }],
  },
  async ({ event, step }) => {
    const manual =
      event.name === "creator/taste.rebuild" ? (event.data as { user_id?: string }) : undefined

    const userIds = await step.run("find-users-with-decisions", async () => {
      if (manual?.user_id) return [manual.user_id]
      // Only users who have actually decided something. Writing an empty
      // profile for everyone else would make tasteBlock's "no profile yet"
      // case indistinguishable from "a profile that says nothing".
      const { data } = await supabaseAdmin
        .schema("creator")
        .from("creator_decisions")
        .select("user_id")
        .gte("decided_at", new Date(Date.now() - 56 * 24 * 3600 * 1000).toISOString())
      return [...new Set((data ?? []).map((r) => r.user_id as string))]
    })

    const results: Array<{ user_id: string; approvals: number; kills: number }> = []
    for (const userId of userIds) {
      // Per user in its own step: one creator's malformed row should not cost
      // everybody else their profile for the week.
      const result = await step.run(`rebuild-${userId}`, async () => {
        const r = await rebuildTasteForUser(supabaseAdmin, userId)
        return { user_id: userId, approvals: r.approve_count, kills: r.kill_count }
      })
      results.push(result)
    }

    return { users: userIds.length, results }
  },
)
