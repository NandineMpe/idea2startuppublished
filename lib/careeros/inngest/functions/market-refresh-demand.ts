import { careerosMinIntervalMs } from "@/lib/careeros/integrations/rate-limits"
import {
  DEMAND_TOP_REGIONS,
  getDemandRegionProfile,
} from "@/lib/careeros/market/demand-regions"
import { DEMAND_TOP_50_SOCS } from "@/lib/careeros/market/demand-soc-list"
import type { DemandWindowCode } from "@/lib/careeros/market/demand-windows"
import { DEMAND_WINDOW_CODES } from "@/lib/careeros/market/demand-windows"
import { DEMAND_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/demand-version"
import {
  refreshDemandCombo,
  resolveOccupationTitleForSoc,
} from "@/lib/careeros/market/demand-compose"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

function parseWindowCodes(): DemandWindowCode[] {
  const raw = process.env.DEMAND_REFRESH_WINDOWS?.trim()
  if (!raw) return [...DEMAND_WINDOW_CODES]
  const parts = raw.split(/[\s,]+/).filter(Boolean)
  const valid = new Set(DEMAND_WINDOW_CODES)
  const out = parts.filter((p): p is DemandWindowCode => valid.has(p as DemandWindowCode))
  return out.length ? out : [...DEMAND_WINDOW_CODES]
}

function cartesianCombos(
  socs: string[],
  regionCodes: string[],
): Array<{ soc: string; region_code: string }> {
  const out: Array<{ soc: string; region_code: string }> = []
  for (const soc of socs) {
    for (const region_code of regionCodes) {
      out.push({ soc, region_code })
    }
  }
  return out
}

export const marketRefreshDemand = careerosInngest.createFunction(
  {
    id: "careeros-market-refresh-demand",
    name: "CareerOS market.refresh-demand (trajectory cache)",
    retries: 1,
    triggers: [
      { cron: "0 2 * * 0" },
      { event: "careeros/market.refresh-demand" },
    ],
  },
  async ({ step, event }) => {
    const windowCodes = parseWindowCodes()
    const windowEnd = new Date()

    const maxCombos = Math.max(
      1,
      Number(process.env.MARKET_DEMAND_MAX_COMBOS_PER_RUN ?? 60),
    )
    const offset = Math.max(
      0,
      Number(
        event?.data &&
          typeof event.data === "object" &&
          event.data !== null &&
          "offset" in event.data
          ? (event.data as { offset?: unknown }).offset
          : 0,
      ),
    )

    let socList = [...DEMAND_TOP_50_SOCS]
    let regionCodes = DEMAND_TOP_REGIONS.map((r) => r.region_code)

    if (
      event?.name === "careeros/market.refresh-demand" &&
      event.data &&
      typeof event.data === "object"
    ) {
      const d = event.data as {
        soc_codes?: unknown
        region_codes?: unknown
      }
      if (Array.isArray(d.soc_codes)) {
        socList = d.soc_codes.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      }
      if (Array.isArray(d.region_codes)) {
        regionCodes = d.region_codes.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
      }
    }

    const allCombos = cartesianCombos(socList, regionCodes)
    const slice = allCombos.slice(offset, offset + maxCombos)

    const startedAt = new Date().toISOString()
    let rowsTotal = 0
    const errors: string[] = []

    await step.run("cache-refresh-run-started", async () => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 7)
      const freshness = `[${start.toISOString().slice(0, 10)},${windowEnd.toISOString().slice(0, 10)}]`
      await supabaseAdmin
        .schema("careeros")
        .from("cache_refresh_runs")
        .insert({
          dataset_key: "market_demand_trajectories",
          workflow_name: "careeros-market-refresh-demand",
          started_at: startedAt,
          completed_at: null,
          status: "running",
          rows_processed: 0,
          rows_inserted: 0,
          rows_updated: 0,
          rows_skipped: 0,
          data_source_version: DEMAND_SOURCE_DATASET_VERSION,
          freshness_window: freshness,
          run_stats: { offset, max_combos: maxCombos, combos_planned: slice.length },
          source_attribution: {},
        })
    })

    for (let i = 0; i < slice.length; i++) {
      const { soc, region_code } = slice[i]!
      const slug = `${soc}:${region_code}`.replace(/[^a-zA-Z0-9.:_-]+/g, "-")

      const stepResult = await step.run(`demand-combo-${i}-${slug}`, async () => {
        const region = getDemandRegionProfile(region_code)
        if (!region) {
          return { ok: false as const, error: "unknown_region" }
        }
        const title = (await resolveOccupationTitleForSoc(soc)) ?? soc
        try {
          const r = await refreshDemandCombo({
            onetSocCode: soc,
            occupationTitle: title,
            region,
            windowEnd,
            windows: windowCodes,
          })
          return { ok: true as const, rowsWritten: r.rowsWritten }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return { ok: false as const, error: msg }
        }
      })

      if (stepResult.ok) {
        rowsTotal += stepResult.rowsWritten
      } else {
        errors.push(`${soc}/${region_code}: ${stepResult.error}`)
      }

      const paceMs = careerosMinIntervalMs("theirstack")
      if (i < slice.length - 1 && paceMs > 0) {
        await step.sleep(`pace-after-${i}-${slug}`, paceMs)
      }
    }

    const completedAt = new Date().toISOString()

    await step.run("cache-refresh-run-finished", async () => {
      const start = new Date()
      start.setUTCDate(start.getUTCDate() - 7)
      const freshness = `[${start.toISOString().slice(0, 10)},${windowEnd.toISOString().slice(0, 10)}]`
      await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
        dataset_key: "market_demand_trajectories",
        workflow_name: "careeros-market-refresh-demand",
        started_at: startedAt,
        completed_at: completedAt,
        status: errors.length ? "completed_with_errors" : "completed",
        rows_processed: rowsTotal,
        rows_inserted: rowsTotal,
        rows_updated: 0,
        rows_skipped: 0,
        data_source_version: DEMAND_SOURCE_DATASET_VERSION,
        freshness_window: freshness,
        run_stats: {
          offset,
          max_combos: maxCombos,
          combos_attempted: slice.length,
          errors: errors.slice(0, 20),
        },
        source_attribution: {},
      })
    })

    return {
      vendor: "demand_trajectories" as const,
      combos_attempted: slice.length,
      rows_written: rowsTotal,
      errors,
      window_codes: windowCodes,
      offset,
      max_combos: maxCombos,
    }
  },
)
