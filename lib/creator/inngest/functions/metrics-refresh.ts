import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Keeps view counts current.
 *
 * Metrics were previously captured once at import and never revisited, which
 * silently rots everything built on them: Worth quotes a rate from stale
 * numbers, and a format's median views understates a post still accumulating.
 *
 * Refresh is bounded rather than exhaustive. Each run takes the posts whose
 * metrics are oldest, capped per user, because the goal is that no post drifts
 * far out of date — not that every post is re-read every day. Volume matters
 * here: the source is an unofficial page fetch, and a full sweep of a large
 * corpus is exactly the traffic pattern that gets an IP challenged.
 */

const MAX_POSTS_PER_USER_PER_RUN = 25
/** Below this age a re-read is unlikely to have moved enough to be worth a request. */
const MIN_HOURS_BETWEEN_REFRESH = 18

export const creatorMetricsRefresh = creatorInngest.createFunction(
  {
    id: "creator-metrics-refresh",
    name: "Creator OS: refresh post metrics",
    retries: 1,
    triggers: [
      { cron: "0 5 * * *" },
      { event: "creator/metrics.refresh" },
    ],
  },
  async ({ event, step }) => {
    const manual = event.name === "creator/metrics.refresh"
      ? (event.data as { user_id?: string })
      : undefined

    const staleBefore = new Date(Date.now() - MIN_HOURS_BETWEEN_REFRESH * 3600 * 1000).toISOString()

    const targets = await step.run("find-stale-posts", async () => {
      let query = supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .select("id,user_id,metrics_captured_at")
        .not("url", "is", null)
        // Nulls first: a post that has never been measured outranks a stale one.
        .order("metrics_captured_at", { ascending: true, nullsFirst: true })
        .limit(MAX_POSTS_PER_USER_PER_RUN * 20)
      if (manual?.user_id) query = query.eq("user_id", manual.user_id)

      const { data, error } = await query
      if (error) throw error

      // Cap per user so one large corpus cannot consume the whole run.
      const perUser = new Map<string, string[]>()
      for (const row of data ?? []) {
        if (row.metrics_captured_at && row.metrics_captured_at > staleBefore) continue
        const userId = row.user_id as string
        const list = perUser.get(userId) ?? []
        if (list.length >= MAX_POSTS_PER_USER_PER_RUN) continue
        list.push(row.id as string)
        perUser.set(userId, list)
      }

      return [...perUser.entries()].flatMap(([userId, ids]) =>
        ids.map((id) => ({ user_id: userId, content_id: id })),
      )
    })

    if (targets.length) {
      await step.sendEvent(
        "fan-out-refresh",
        targets.map((t) => ({
          name: "creator/content.enrich" as const,
          data: t,
        })),
      )
    }

    return { refreshed: targets.length }
  },
)
