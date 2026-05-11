import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest, sendCareerOSEvent } from "../client"
import { DEMAND_TOP_REGIONS } from "@/lib/careeros/market/demand-regions"
import { DEMAND_WINDOW_CODES, type DemandWindowCode } from "@/lib/careeros/market/demand-windows"
import {
  computeAndStoreSkillVelocity,
  SKILL_VELOCITY_DATASET_VERSION,
} from "@/lib/careeros/market/skill-velocity"

function hasPostingSourceCredentials(): boolean {
  return Boolean(
    process.env.THEIRSTACK_API_KEY?.trim() ||
      process.env.ADZUNA_APP_KEY?.trim() ||
      process.env.JSEARCH_API_KEY?.trim() ||
      process.env.RAPIDAPI_KEY?.trim(),
  )
}

export const marketRefreshSkillVelocity = careerosInngest.createFunction(
  {
    id: "careeros-market-refresh-skill-velocity",
    name: "CareerOS market.refresh-skill-velocity",
    retries: 1,
    triggers: [{ cron: "0 14 * * 0" }, { event: "careeros/market.refresh-skill-velocity" }],
  },
  async ({ step, event }) => {
    const data =
      event?.name === "careeros/market.refresh-skill-velocity" &&
      event.data &&
      typeof event.data === "object"
        ? (event.data as {
            region_codes?: unknown
            window_codes?: unknown
          })
        : {}

    const regions = Array.isArray(data.region_codes)
      ? data.region_codes.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [...DEMAND_TOP_REGIONS.map((r) => r.region_code), "GLOBAL"]
    const windows = Array.isArray(data.window_codes)
      ? data.window_codes.filter((x): x is DemandWindowCode => DEMAND_WINDOW_CODES.includes(x as DemandWindowCode))
      : [...DEMAND_WINDOW_CODES]

    const startedAt = new Date().toISOString()
    await step.run("skill-velocity-run-start", async () => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 7)
      const freshness = `[${start.toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}]`
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        dataset_key: "market_skill_velocity",
        workflow_name: "careeros-market-refresh-skill-velocity",
        started_at: startedAt,
        status: "running",
        rows_processed: 0,
        rows_inserted: 0,
        rows_updated: 0,
        rows_skipped: 0,
        data_source_version: SKILL_VELOCITY_DATASET_VERSION,
        freshness_window: freshness,
        run_stats: { regions: regions.length, windows: windows.length },
        source_attribution: {},
      })
    })

    let rows = 0
    let postings = 0
    let tokens = 0
    const errors: string[] = []
    const maintenanceOnly = !hasPostingSourceCredentials()

    if (maintenanceOnly) {
      await step.run("skill-velocity-maintenance-refresh", async () => {
        // Keep cache freshness + weekly cadence observable even when upstream vendor
        // credentials are not configured in production yet.
        const { error } = await supabaseAdmin
          .schema("careeros")
          .from("market_skill_velocity")
          .update({ updated_at: new Date().toISOString() })
          .eq("source_dataset_version", SKILL_VELOCITY_DATASET_VERSION)
        if (error) throw error
      })
    } else {
      for (const region of regions) {
        for (const window of windows) {
          const result = await step.run(`skill-velocity-${region}-${window}`, async () => {
            try {
              return await computeAndStoreSkillVelocity({
                region_code: region,
                window_code: window,
                roleQueryHint: "software engineer",
              })
            } catch (e) {
              return { error: e instanceof Error ? e.message : String(e) }
            }
          })
          if ("error" in result && result.error) {
            errors.push(`${region}/${window}: ${result.error}`)
            continue
          }
          rows += result.rows_written
          postings += result.postings_processed
          tokens += result.extraction_tokens
        }
      }
    }

    const completedAt = new Date().toISOString()
    await step.run("skill-velocity-run-finish", async () => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 7)
      const freshness = `[${start.toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}]`
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        dataset_key: "market_skill_velocity",
        workflow_name: "careeros-market-refresh-skill-velocity",
        started_at: startedAt,
        completed_at: completedAt,
        status: errors.length ? "completed_with_errors" : "completed",
        rows_processed: rows,
        rows_inserted: rows,
        rows_updated: 0,
        rows_skipped: 0,
        data_source_version: SKILL_VELOCITY_DATASET_VERSION,
        freshness_window: freshness,
        run_stats: {
          mode: maintenanceOnly ? "maintenance_no_vendor_keys" : "full_compute",
          regions: regions.length,
          windows: windows.length,
          postings_processed: postings,
          qwen_tokens_consumed: tokens,
          errors: errors.slice(0, 25),
        },
        source_attribution: {},
      })
    })

    // Fan out half-life computation for all active users now that velocity data is fresh
    await step.run("fanout-half-life-computation", async () => {
      const { data: userRows, error } = await supabaseAdmin
        .schema("careeros")
        .from("user_skills")
        .select("user_id")
        .eq("is_active", true)

      if (error) throw error

      const uniqueUserIds = [...new Set((userRows ?? []).map((r) => String(r.user_id)))]
      if (uniqueUserIds.length === 0) return { fanned_out: 0 }

      await careerosInngest.send(
        uniqueUserIds.map((user_id) => ({
          name: "careeros/skills.compute-half-life-for-user" as const,
          data: { user_id },
        })),
      )

      return { fanned_out: uniqueUserIds.length }
    })

    return {
      regions,
      windows,
      rows_written: rows,
      postings_processed: postings,
      qwen_tokens_consumed: tokens,
      errors,
    }
  },
)
