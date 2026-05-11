import { matchUserRegionToDemandRegion } from "@/lib/careeros/market/demand-regions"
import type { DemandWindowCode } from "@/lib/careeros/market/demand-windows"
import { DEMAND_WINDOW_CODES } from "@/lib/careeros/market/demand-windows"
import { DEMAND_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/demand-version"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { supabaseAdmin } from "@/lib/supabase"

export type DemandWindowSnapshot = {
  window_code: DemandWindowCode
  window_start: string
  window_end: string
  demand_index: number | null
  demand_delta_pct: number | null
  source_attribution: Record<string, unknown>
}

export type DemandTrajectoryResult =
  | {
      status: "ready"
      onet_soc_code: string
      region_code: string
      occupation_title?: string | null
      windows: Partial<Record<DemandWindowCode, DemandWindowSnapshot>>
      comparison?: Record<
        string,
        Partial<Record<DemandWindowCode, DemandWindowSnapshot>>
      >
    }
  | {
      status: "profile_incomplete"
      reason: "missing_onet_soc_or_region"
      onet_soc_code: string | null
      region_code: string | null
    }
  | {
      status: "cache_miss"
      onet_soc_code: string
      region_code: string
      refresh_requested: boolean
      message: string
    }

export async function getDemandTrajectoryForUser(
  userId: string,
  options?: { triggerRefreshOnMiss?: boolean; compareSocCodes?: string[] },
): Promise<DemandTrajectoryResult> {
  const { data: profile, error: pErr } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("onet_soc_code,location_region_code,current_role_title")
    .eq("user_id", userId)
    .maybeSingle()

  if (pErr) {
    throw new Error(pErr.message)
  }

  const onet = (profile?.onet_soc_code as string | null)?.trim() || null
  const regionRaw = (profile?.location_region_code as string | null)?.trim() || null
  const region = matchUserRegionToDemandRegion(regionRaw) || regionRaw

  if (!onet || !region) {
    return {
      status: "profile_incomplete",
      reason: "missing_onet_soc_or_region",
      onet_soc_code: onet,
      region_code: region,
    }
  }

  const { data: rows, error: rErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_demand_trajectories")
    .select(
      "window_code,window_start,window_end,demand_index,demand_delta_pct,source_attribution,created_at",
    )
    .eq("onet_soc_code", onet)
    .eq("region_code", region)
    .eq("source_dataset_version", DEMAND_SOURCE_DATASET_VERSION)
    .order("window_end", { ascending: false })
    .limit(200)

  if (rErr) {
    throw new Error(rErr.message)
  }

  const list = rows ?? []
  if (!list.length && options?.triggerRefreshOnMiss !== false) {
    await sendCareerOSEvent({
      name: "careeros/market.refresh-demand",
      data: {
        soc_codes: [onet],
        region_codes: [region],
        max_combos: 1,
        offset: 0,
      },
    })
    return {
      status: "cache_miss",
      onet_soc_code: onet,
      region_code: region,
      refresh_requested: true,
      message:
        "Demand cache miss — a targeted refresh was queued. Check back shortly.",
    }
  }

  if (!list.length) {
    return {
      status: "cache_miss",
      onet_soc_code: onet,
      region_code: region,
      refresh_requested: false,
      message: "No demand trajectory rows yet for your role and region.",
    }
  }

  const latestByWindow: Partial<Record<DemandWindowCode, DemandWindowSnapshot>> = {}
  for (const code of DEMAND_WINDOW_CODES) {
    const row = list.find((r) => r.window_code === code)
    if (!row) continue
    latestByWindow[code] = {
      window_code: code as DemandWindowCode,
      window_start: String(row.window_start),
      window_end: String(row.window_end),
      demand_index: typeof row.demand_index === "number" ? row.demand_index : null,
      demand_delta_pct:
        typeof row.demand_delta_pct === "number" ? row.demand_delta_pct : null,
      source_attribution:
        row.source_attribution && typeof row.source_attribution === "object"
          ? (row.source_attribution as Record<string, unknown>)
          : {},
    }
  }

  const compare = options?.compareSocCodes ?? []
  const overlay: Record<string, Partial<Record<DemandWindowCode, DemandWindowSnapshot>>> = {}

  for (const soc of compare) {
    if (soc === onet) continue
    const { data: overlayRows } = await supabaseAdmin
      .schema("careeros")
      .from("market_demand_trajectories")
      .select(
        "window_code,window_start,window_end,demand_index,demand_delta_pct,source_attribution",
      )
      .eq("onet_soc_code", soc)
      .eq("region_code", region)
      .eq("source_dataset_version", DEMAND_SOURCE_DATASET_VERSION)
      .order("window_end", { ascending: false })
      .limit(40)

    const byW: Partial<Record<DemandWindowCode, DemandWindowSnapshot>> = {}
    for (const code of DEMAND_WINDOW_CODES) {
      const row = overlayRows?.find((r) => r.window_code === code)
      if (!row) continue
      byW[code] = {
        window_code: code as DemandWindowCode,
        window_start: String(row.window_start),
        window_end: String(row.window_end),
        demand_index: typeof row.demand_index === "number" ? row.demand_index : null,
        demand_delta_pct:
          typeof row.demand_delta_pct === "number" ? row.demand_delta_pct : null,
        source_attribution:
          row.source_attribution && typeof row.source_attribution === "object"
            ? (row.source_attribution as Record<string, unknown>)
            : {},
      }
    }
    overlay[soc] = byW
  }

  const ready: DemandTrajectoryResult = {
    status: "ready",
    onet_soc_code: onet,
    region_code: region,
    occupation_title: profile?.current_role_title as string | null | undefined,
    windows: latestByWindow,
    ...(Object.keys(overlay).length ? { comparison: overlay } : {}),
  }

  return ready
}
