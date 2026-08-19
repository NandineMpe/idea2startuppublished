import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"
import { checkThread, loadDueThreads } from "@/lib/creator/threads/check"

/**
 * Go back to the open files.
 *
 * The sweep asks what moved today. This asks what happened to the things
 * everyone stopped covering, which is the only one of the two that nobody else
 * is running. Of everything here it is the least harmed by running on request:
 * a story unresolved for eight months does not care whether it was looked at on
 * Tuesday, and each thread carries its own next_check_at, so a run after a long
 * gap picks up exactly the ones that came due while nobody was looking.
 *
 * The batch is small on purpose. Each check searches eleven primary lanes
 * across the whole span since the thread was opened, so this is far heavier per
 * item than a sweep.
 */
const THREADS_PER_USER_PER_RUN = 4

export const creatorThreadsCheck = creatorInngest.createFunction(
  {
    id: "creator-threads-check",
    name: "Creator OS: check open threads",
    retries: 2,
    triggers: [{ event: "creator/threads.check" }],
  },
  async ({ event, step }) => {
    const manual =
      event.name === "creator/threads.check"
        ? (event.data as { user_id?: string; limit?: number })
        : undefined

    const userIds = await step.run("resolve-users", async () => {
      if (manual?.user_id) return [manual.user_id]
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_threads")
        .select("user_id")
        .is("deleted_at", null)
        .in("state", ["watching", "moved"])
        .lte("next_check_at", new Date().toISOString())
      if (error) throw error
      return [...new Set((data ?? []).map((r) => r.user_id as string))]
    })

    const summaries: Array<{ user_id: string; checked: number; moved: number }> = []

    for (const userId of userIds) {
      const due = await step.run(`due-${userId}`, async () =>
        loadDueThreads(supabaseAdmin, userId, manual?.limit ?? THREADS_PER_USER_PER_RUN),
      )

      let checked = 0
      let moved = 0

      // One step per thread, so a slow lane cannot exhaust the invocation and
      // take the whole batch with it. The sweep learned this the hard way.
      for (const [i, thread] of due.entries()) {
        const result = await step.run(`check-${userId}-${i}`, async () =>
          checkThread(supabaseAdmin, userId, thread),
        )
        checked++
        if (result.ok && result.moved) moved++
      }

      summaries.push({ user_id: userId, checked, moved })
    }

    return { users: userIds.length, summaries }
  },
)
