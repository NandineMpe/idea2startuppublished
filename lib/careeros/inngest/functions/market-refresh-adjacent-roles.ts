import { randomUUID } from "crypto"
import { refreshMarketAdjacentRoles } from "@/lib/careeros/market/adjacent-roles"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

export const marketRefreshAdjacentRoles = careerosInngest.createFunction(
  {
    id: "careeros-market-refresh-adjacent-roles",
    retries: 1,
    triggers: [
      { event: "careeros/market.refresh-adjacent-roles" },
      { cron: "TZ=UTC 0 15 * * 0" },
    ],
  },
  async ({ event, step }) => {
    const startedAt = new Date().toISOString()
    const requestedSources = Array.isArray(event.data?.source_soc_codes)
      ? (event.data?.source_soc_codes as string[])
      : undefined
    const topK =
      typeof event.data?.top_k === "number" && Number.isFinite(event.data.top_k)
        ? event.data.top_k
        : undefined

    const result = await step.run("refresh-adjacent-cache", async () =>
      refreshMarketAdjacentRoles({ sourceSocCodes: requestedSources, topK }),
    )

    await step.run("audit-refresh-run", async () => {
      const { error } = await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        id: randomUUID(),
        dataset_key: "market_adjacent_roles",
        workflow_name: "careeros-market-refresh-adjacent-roles",
        status: "completed",
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        rows_processed: result.source_count,
        rows_inserted: result.rows_written,
        rows_updated: 0,
        rows_skipped: 0,
        data_source_version: "adjacent-roles-v1",
        freshness_window: null,
        run_stats: { top_k: result.top_k },
        source_attribution: {},
      })
      if (error) throw error
    })

    return result
  },
)
