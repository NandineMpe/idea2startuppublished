import type { DemandRegionProfile } from "@/lib/careeros/market/demand-regions"
import {
  type DemandWindowCode,
  DEMAND_WINDOW_CODES,
  DEMAND_WINDOW_DAYS,
  windowStartFromEnd,
} from "@/lib/careeros/market/demand-windows"
import { DEMAND_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/demand-version"
import { fetchAdzunaTotalCount } from "@/lib/careeros/integrations/adzuna-job-count"
import { fetchJSearchTotalJobs } from "@/lib/careeros/integrations/jsearch-job-count"
import { delayForCareerOsVendor } from "@/lib/careeros/integrations/rate-limits"
import { fetchTheirStackJobCount } from "@/lib/careeros/integrations/theirstack-job-count"
import { supabaseAdmin } from "@/lib/supabase"

export type SourceAttributionPayload = {
  composition_rule: string
  theirstack?: Record<string, unknown>
  adzuna?: Record<string, unknown>
  jsearch?: Record<string, unknown>
  conflicts?: string[]
  is_partial?: boolean
  data_completeness?: string
  /** When TheirStack history &lt; requested window (honest partial spine). */
  window_note?: string
}

/** Conflict rule: JSearch warns only if &gt;50% deviation from TheirStack primary (Module 2.1 rubric). */
function deviationWarning(primary?: number, check?: number): string | undefined {
  if (primary == null || check == null || primary <= 0) return undefined
  const ratio = Math.abs(check - primary) / primary
  if (ratio > 0.5) {
    return `jsearch_deviates_${Math.round(ratio * 100)}pct_from_theirstack`
  }
  return undefined
}

export async function refreshDemandCombo(params: {
  onetSocCode: string
  occupationTitle: string
  region: DemandRegionProfile
  windowEnd: Date
  /** Subset of DEMAND_WINDOW_CODES to refresh (quota control). */
  windows?: DemandWindowCode[]
}): Promise<{ rowsWritten: number; attribution: SourceAttributionPayload }> {
  const windows =
    params.windows?.length ? params.windows : [...DEMAND_WINDOW_CODES]

  const title =
    params.occupationTitle.trim() ||
    params.onetSocCode.replace(/-/g, " ").replace(/\.\d+$/, "")

  const theirstackByWindow: Partial<
    Record<DemandWindowCode, Awaited<ReturnType<typeof fetchTheirStackJobCount>>>
  > = {}

  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi]!
    const days = DEMAND_WINDOW_DAYS[w]
    theirstackByWindow[w] = await fetchTheirStackJobCount({
      jobTitles: [title],
      postedMaxAgeDays: days,
      countryCodes: params.region.theirstack_country_codes,
    })
    if (wi < windows.length - 1) {
      await delayForCareerOsVendor("theirstack")
    }
  }

  await delayForCareerOsVendor("adzuna")

  const adzuna = await fetchAdzunaTotalCount({
    country: params.region.adzuna_country,
    keywords: title,
  })

  await delayForCareerOsVendor("jsearch")

  const jsearch = await fetchJSearchTotalJobs({
    query: title,
    location: params.region.jsearch_location,
  })

  const m30Ts = theirstackByWindow.M30
  const primaryM30 =
    m30Ts?.ok && m30Ts.totalResults != null ? m30Ts.totalResults : undefined

  const conflicts: string[] = []
  const warn = deviationWarning(primaryM30, jsearch.totalJobs)
  if (warn) conflicts.push(warn)

  const is_partial =
    Boolean(m30Ts && !m30Ts.ok) ||
    Boolean(!adzuna.ok) ||
    windows.some((w) => !theirstackByWindow[w]?.ok)

  const rows: Array<Record<string, unknown>> = []

  for (const w of windows) {
    const ts = theirstackByWindow[w]
    const demandRaw =
      ts?.ok && ts.totalResults != null
        ? ts.totalResults
        : adzuna.ok && adzuna.count != null
          ? adzuna.count
          : null

    const windowEndStr = params.windowEnd.toISOString().slice(0, 10)
    const ws = windowStartFromEnd(params.windowEnd, w)

    const prior = await loadPriorDemandIndex(
      params.onetSocCode,
      params.region.region_code,
      w,
      params.windowEnd,
    )

    let demand_delta_pct: number | null = null
    if (demandRaw != null && prior != null && prior > 0) {
      demand_delta_pct = Math.round(((demandRaw - prior) / prior) * 10000) / 100
    } else if (demandRaw != null && (prior == null || prior <= 0)) {
      demand_delta_pct = null
    }

    const source_attribution: SourceAttributionPayload = {
      composition_rule:
        "primary_theirstack_posting_count_else_adzuna_count_field_else_null",
      theirstack: ts
        ? {
            ok: ts.ok,
            status: ts.status,
            total_results: ts.totalResults ?? null,
            window_days: DEMAND_WINDOW_DAYS[w],
          }
        : undefined,
      adzuna: {
        ok: adzuna.ok,
        status: adzuna.status,
        count_field: adzuna.count ?? null,
      },
      jsearch: {
        ok: jsearch.ok,
        status: jsearch.status,
        total_jobs: jsearch.totalJobs ?? null,
      },
      conflicts: conflicts.length ? conflicts : undefined,
      is_partial,
      data_completeness:
        ts?.ok && ts.totalResults != null ? "full" : "partial_or_fallback",
    }

    rows.push({
      onet_soc_code: params.onetSocCode,
      region_code: params.region.region_code,
      window_code: w,
      window_start: ws.toISOString().slice(0, 10),
      window_end: windowEndStr,
      demand_index: demandRaw,
      demand_delta_pct,
      source_dataset_version: DEMAND_SOURCE_DATASET_VERSION,
      source_attribution,
    })
  }

  const { error } = await supabaseAdmin
    .schema("careeros")
    .from("market_demand_trajectories")
    .upsert(rows, {
      onConflict: "onet_soc_code,region_code,window_code,window_end,source_dataset_version",
    })

  if (error) {
    throw new Error(error.message)
  }

  return {
    rowsWritten: rows.length,
    attribution: {
      composition_rule: "primary_theirstack_posting_count_else_adzuna_count_field_else_null",
      is_partial,
      conflicts: conflicts.length ? conflicts : undefined,
    },
  }
}

async function loadPriorDemandIndex(
  onetSocCode: string,
  regionCode: string,
  windowCode: DemandWindowCode,
  currentWindowEnd: Date,
): Promise<number | null> {
  const endStr = currentWindowEnd.toISOString().slice(0, 10)
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_demand_trajectories")
    .select("demand_index, window_end")
    .eq("onet_soc_code", onetSocCode)
    .eq("region_code", regionCode)
    .eq("window_code", windowCode)
    .eq("source_dataset_version", DEMAND_SOURCE_DATASET_VERSION)
    .lt("window_end", endStr)
    .order("window_end", { ascending: false })
    .limit(1)

  if (error || !data?.length) return null
  const v = data[0]?.demand_index
  return typeof v === "number" ? v : null
}

export async function resolveOccupationTitleForSoc(onetSocCode: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .schema("careeros")
    .from("onet_occupations_cache")
    .select("title")
    .eq("onet_soc_code", onetSocCode)
    .limit(1)
    .maybeSingle()

  const t = data?.title as string | undefined
  return t?.trim() ? t.trim() : null
}
