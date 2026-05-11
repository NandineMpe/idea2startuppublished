import { careerosMinIntervalMs } from "@/lib/careeros/integrations/rate-limits"
import { DEMAND_TOP_REGIONS } from "@/lib/careeros/market/demand-regions"
import { DEMAND_TOP_50_SOCS } from "@/lib/careeros/market/demand-soc-list"
import { resolveOccupationTitleForSoc } from "@/lib/careeros/market/demand-compose"
import { refreshSalaryBandsCombo, resolveRegionProfiles } from "@/lib/careeros/market/salary-bands"
import { SALARY_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/salary-version"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

type Combo = { soc: string; region_code: string }

function combinations(socs: string[], regions: string[]): Combo[] {
  const out: Combo[] = []
  for (const soc of socs) {
    for (const region_code of regions) out.push({ soc, region_code })
  }
  return out
}

export const marketRefreshSalary = careerosInngest.createFunction(
  {
    id: "careeros-market-refresh-salary",
    name: "CareerOS market.refresh-salary (salary bands)",
    retries: 1,
    triggers: [{ cron: "30 2 * * 0" }, { event: "careeros/market.refresh-salary" }],
  },
  async ({ step, event }) => {
    const data =
      event?.name === "careeros/market.refresh-salary" &&
      event.data &&
      typeof event.data === "object"
        ? (event.data as {
            soc_codes?: unknown
            region_codes?: unknown
            offset?: unknown
            max_combos?: unknown
          })
        : {}

    const socs = Array.isArray(data.soc_codes)
      ? data.soc_codes.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [...DEMAND_TOP_50_SOCS]

    const regions = Array.isArray(data.region_codes)
      ? data.region_codes.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : DEMAND_TOP_REGIONS.map((r) => r.region_code)

    const offset = Math.max(0, Number(data.offset ?? 0) || 0)
    const maxCombos = Math.max(1, Number(data.max_combos ?? process.env.MARKET_SALARY_MAX_COMBOS_PER_RUN ?? 80) || 80)
    const planned = combinations(socs, regions).slice(offset, offset + maxCombos)

    const startedAt = new Date().toISOString()
    let rowsWritten = 0
    const errors: string[] = []

    await step.run("salary-refresh-run-start", async () => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 7)
      const freshness = `[${start.toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}]`
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        dataset_key: "market_salary_bands",
        workflow_name: "careeros-market-refresh-salary",
        started_at: startedAt,
        completed_at: null,
        status: "running",
        rows_processed: 0,
        rows_inserted: 0,
        rows_updated: 0,
        rows_skipped: 0,
        data_source_version: SALARY_SOURCE_DATASET_VERSION,
        freshness_window: freshness,
        run_stats: { offset, max_combos: maxCombos, combos_planned: planned.length },
        source_attribution: {},
      })
    })

    for (let i = 0; i < planned.length; i++) {
      const c = planned[i]!
      const region = (await resolveRegionProfiles([c.region_code]))[0]
      if (!region) {
        errors.push(`${c.soc}/${c.region_code}: unknown_region`)
        continue
      }

      const title = (await resolveOccupationTitleForSoc(c.soc)) ?? c.soc
      const res = await step.run(`salary-combo-${i}-${c.soc}-${c.region_code}`, async () => {
        try {
          return await refreshSalaryBandsCombo({
            onetSocCode: c.soc,
            occupationTitle: title,
            region,
          })
        } catch (e) {
          return { rowsWritten: 0, error: e instanceof Error ? e.message : String(e) }
        }
      })

      if ("error" in res && res.error) {
        errors.push(`${c.soc}/${c.region_code}: ${res.error}`)
      } else {
        rowsWritten += res.rowsWritten
      }

      const paceMs = careerosMinIntervalMs("adzuna")
      if (i < planned.length - 1 && paceMs > 0) {
        await step.sleep(`salary-pace-${i}`, paceMs)
      }
    }

    const completedAt = new Date().toISOString()
    await step.run("salary-refresh-run-finish", async () => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 7)
      const freshness = `[${start.toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}]`
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        dataset_key: "market_salary_bands",
        workflow_name: "careeros-market-refresh-salary",
        started_at: startedAt,
        completed_at: completedAt,
        status: errors.length ? "completed_with_errors" : "completed",
        rows_processed: rowsWritten,
        rows_inserted: rowsWritten,
        rows_updated: 0,
        rows_skipped: 0,
        data_source_version: SALARY_SOURCE_DATASET_VERSION,
        freshness_window: freshness,
        run_stats: {
          offset,
          max_combos: maxCombos,
          combos_attempted: planned.length,
          errors: errors.slice(0, 30),
        },
        source_attribution: {},
      })
    })

    return {
      dataset_key: "market_salary_bands" as const,
      offset,
      max_combos: maxCombos,
      combos_attempted: planned.length,
      rows_written: rowsWritten,
      errors,
    }
  },
)
