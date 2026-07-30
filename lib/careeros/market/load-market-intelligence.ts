import { fetchAdzunaTotalCount } from "@/lib/careeros/integrations/adzuna-job-count"
import { fetchJSearchTotalJobs } from "@/lib/careeros/integrations/jsearch-job-count"
import { delayForCareerOsVendor } from "@/lib/careeros/integrations/rate-limits"
import { fetchTheirStackJobCount } from "@/lib/careeros/integrations/theirstack-job-count"
import { fetchTheirStackJobListings } from "@/lib/careeros/integrations/theirstack-job-listings"
import {
  getMarketCapabilities,
  type MarketDataSource,
} from "@/lib/careeros/market/market-data-sources"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { getAdjacentRolesForUser } from "@/lib/careeros/market/adjacent-roles"
import { getDemandTrajectoryForUser } from "@/lib/careeros/market/demand-trajectory"
import {
  getDemandRegionProfile,
  matchUserRegionToDemandRegion,
} from "@/lib/careeros/market/demand-regions"
import type { DemandWindowCode } from "@/lib/careeros/market/demand-windows"
import { getSalaryBandsForUser } from "@/lib/careeros/market/salary-bands"
import { resolveOccupationTitleForSoc } from "@/lib/careeros/market/demand-compose"
import { supabaseAdmin } from "@/lib/supabase"

export type MarketJobListing = {
  title: string
  company_name: string
  url: string
  posted_at: string | null
  location_label: string | null
}

export type MarketAdjacentRole = {
  target_soc_code: string
  target_title: string
  rank_position: number
  fit_pct: number
  bridge_skills: string[]
  bridge_skill_count: number
  salary_mid_delta_usd: number | null
  salary_mid_delta_pct: number | null
  demand_delta_pct_points: number | null
  source_salary_mid: number | null
  target_salary_mid: number | null
  evidence_similarity: string
  listings: MarketJobListing[]
  listings_total: number | null
  evidence_listings: string
}

export type MarketIntelligencePayload = {
  status: "ready" | "profile_incomplete" | "empty"
  profile_incomplete_reason?: string
  current_role_title: string | null
  target_role_title: string | null
  source_soc_code: string | null
  region_code: string | null
  region_label: string | null
  currency_symbol: string
  demand_index: number | null
  demand_delta_90d: string | null
  demand_series: number[]
  demand_evidence: string | null
  postings_count: number | null
  postings_evidence: string | null
  salary_p50: number | null
  salary_evidence: string | null
  current_salary_mid: number | null
  adjacent_status: "ready" | "cache_miss" | "profile_incomplete"
  adjacent_roles: MarketAdjacentRole[]
  cache_misses: string[]
  data_sources: MarketDataSource[]
  live_postings_vendor: "adzuna" | "jsearch" | "theirstack" | null
  job_listings_live: boolean
  can_refresh_cache: boolean
  needs_onet_map: boolean
}

function currencySymbol(regionCode: string | null, currencyCode: string | null): string {
  if (currencyCode === "USD") return "$"
  if (currencyCode === "EUR") return "€"
  if (regionCode?.startsWith("US")) return "$"
  if (regionCode === "IE") return "€"
  return "£"
}

function formatDeltaPct(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null
  const sign = v > 0 ? "+" : ""
  return `${sign}${v.toFixed(1)}%`
}

function demandSeriesFromWindows(
  windows: Partial<Record<DemandWindowCode, { demand_index: number | null }>>,
): number[] {
  const order: DemandWindowCode[] = ["M720", "M360", "M180", "M90", "M30"]
  const pts = order
    .map((c) => windows[c]?.demand_index)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  return pts.length >= 2 ? pts : pts.length === 1 ? [pts[0]!, pts[0]!] : []
}

function formatUsd(symbol: string, n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—"
  if (n >= 1000) return `${symbol}${Math.round(n / 1000)}k`
  return `${symbol}${Math.round(n)}`
}

function listingsEvidence(attribution: {
  queried_at: string
  posted_at_max_age_days: number
  job_title: string
  country_codes: string[]
}): string {
  const countries = attribution.country_codes.join(", ") || "—"
  const day = attribution.queried_at.slice(0, 10)
  return `TheirStack · "${attribution.job_title}" · ${countries} · last ${attribution.posted_at_max_age_days}d · queried ${day}`
}

async function fetchLivePostingsCount(params: {
  vendor: "adzuna" | "jsearch" | "theirstack"
  queryTitle: string
  regionProfile: ReturnType<typeof getDemandRegionProfile>
}): Promise<{ count: number | null; evidence: string | null }> {
  const { vendor, queryTitle, regionProfile } = params
  const region = regionProfile ?? getDemandRegionProfile("GB-LON")!

  if (vendor === "theirstack") {
    await delayForCareerOsVendor("theirstack")
    const countRes = await fetchTheirStackJobCount({
      jobTitles: [queryTitle],
      postedMaxAgeDays: 30,
      countryCodes: region.theirstack_country_codes,
    })
    if (countRes.ok && countRes.totalResults != null) {
      return {
        count: countRes.totalResults,
        evidence: `TheirStack · "${queryTitle}" · ${region.theirstack_country_codes.join(", ")} · last 30d`,
      }
    }
    return {
      count: null,
      evidence: countRes.error
        ? `TheirStack: ${countRes.error.slice(0, 80)}`
        : "TheirStack count unavailable",
    }
  }

  if (vendor === "adzuna") {
    await delayForCareerOsVendor("adzuna")
    const res = await fetchAdzunaTotalCount({
      country: region.adzuna_country,
      keywords: queryTitle,
    })
    if (res.ok && res.count != null) {
      return {
        count: res.count,
        evidence: `Adzuna · "${queryTitle}" · ${region.adzuna_country.toUpperCase()} · total matches`,
      }
    }
    return {
      count: null,
      evidence: res.error ? `Adzuna: ${res.error.slice(0, 80)}` : "Adzuna count unavailable",
    }
  }

  await delayForCareerOsVendor("jsearch")
  const res = await fetchJSearchTotalJobs({
    query: queryTitle,
    location: region.jsearch_location,
  })
  if (res.ok && res.totalJobs != null) {
    return {
      count: res.totalJobs,
      evidence: `JSearch · "${queryTitle}" · ${region.jsearch_location}`,
    }
  }
  return {
    count: null,
    evidence: res.error ? `JSearch: ${res.error.slice(0, 80)}` : "JSearch count unavailable",
  }
}

function profileIncompleteReason(params: {
  soc: string | null
  region: string | null
  targetRoleTitle: string | null
  caps: ReturnType<typeof getMarketCapabilities>
}): string {
  const { soc, region, targetRoleTitle, caps } = params
  if (!soc && !region) {
    return "Add your current role, target role, and region in onboarding so we can map O*NET and pull market data."
  }
  if (!soc) {
    if (targetRoleTitle && caps.onet_configured) {
      return `We have "${targetRoleTitle}" but no O*NET SOC yet. Hit Refresh cache to run O*NET mapping, then reload.`
    }
    if (targetRoleTitle) {
      return `We have "${targetRoleTitle}" but O*NET credentials are not set on the server, so we cannot map your SOC code.`
    }
    return "Add a target role in your profile so we can map it to an O*NET occupation."
  }
  if (!region) {
    return "Set your region in profile settings so salary and demand use the right geo filters."
  }
  return "Profile is missing fields needed for market data."
}

function basePayloadFields(
  caps: ReturnType<typeof getMarketCapabilities>,
  extras: Partial<MarketIntelligencePayload> = {},
): Pick<
  MarketIntelligencePayload,
  | "data_sources"
  | "live_postings_vendor"
  | "job_listings_live"
  | "can_refresh_cache"
  | "needs_onet_map"
> {
  return {
    data_sources: caps.sources,
    live_postings_vendor: caps.live_postings_vendor,
    job_listings_live: caps.job_listings_live,
    can_refresh_cache: caps.any_market_refresh_api,
    needs_onet_map: false,
    ...extras,
  }
}

export async function queueMarketRefreshForUser(userId: string): Promise<{
  queued: string[]
}> {
  const caps = getMarketCapabilities()
  const { data: profile } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("onet_soc_code,location_region_code,target_role_title,current_role_title")
    .eq("user_id", userId)
    .maybeSingle()

  const soc = (profile?.onet_soc_code as string | null)?.trim() || null
  const regionRaw = (profile?.location_region_code as string | null)?.trim() || null
  const region = matchUserRegionToDemandRegion(regionRaw) || regionRaw
  const hasRoleText =
    Boolean((profile?.target_role_title as string | null)?.trim()) ||
    Boolean((profile?.current_role_title as string | null)?.trim())

  const queued: string[] = []

  if (!soc && hasRoleText && caps.onet_configured && caps.inngest_configured) {
    await sendCareerOSEvent({
      name: "careeros/profile.onet-map",
      data: { user_id: userId },
    })
    queued.push("careeros/profile.onet-map")
  }

  if (soc) {
    await sendCareerOSEvent({
      name: "careeros/market.refresh-adjacent-roles",
      data: { source_soc_codes: [soc], top_k: 8 },
    })
    queued.push("careeros/market.refresh-adjacent-roles")
  }
  if (soc && region) {
    await sendCareerOSEvent({
      name: "careeros/market.refresh-demand",
      data: { soc_codes: [soc], region_codes: [region], max_combos: 1, offset: 0 },
    })
    queued.push("careeros/market.refresh-demand")
    await sendCareerOSEvent({
      name: "careeros/market.refresh-salary",
      data: { soc_codes: [soc], region_codes: [region], max_combos: 1, offset: 0 },
    })
    queued.push("careeros/market.refresh-salary")
  }
  return { queued }
}

export async function loadMarketIntelligenceForUser(
  userId: string,
): Promise<MarketIntelligencePayload> {
  const caps = getMarketCapabilities()

  const { data: profile } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select(
      "onet_soc_code,location_region_code,current_role_title,target_role_title,current_salary_usd",
    )
    .eq("user_id", userId)
    .maybeSingle()

  const soc = (profile?.onet_soc_code as string | null)?.trim() || null
  const regionRaw = (profile?.location_region_code as string | null)?.trim() || null
  const region = matchUserRegionToDemandRegion(regionRaw) || regionRaw
  const regionProfile = region ? getDemandRegionProfile(region) : null
  const currentRoleTitle = (profile?.current_role_title as string | null)?.trim() || null
  const targetRoleTitle =
    (profile?.target_role_title as string | null)?.trim() ||
    (soc ? await resolveOccupationTitleForSoc(soc) : null)

  if (!soc) {
    return {
      status: "profile_incomplete",
      profile_incomplete_reason: profileIncompleteReason({
        soc,
        region,
        targetRoleTitle,
        caps,
      }),
      current_role_title: currentRoleTitle,
      target_role_title: targetRoleTitle,
      source_soc_code: null,
      region_code: region,
      region_label: regionProfile?.label ?? region,
      currency_symbol: currencySymbol(region, null),
      demand_index: null,
      demand_delta_90d: null,
      demand_series: [],
      demand_evidence: null,
      postings_count: null,
      postings_evidence: null,
      salary_p50: null,
      salary_evidence: null,
      current_salary_mid:
        typeof profile?.current_salary_usd === "number" ? profile.current_salary_usd : null,
      adjacent_status: "profile_incomplete",
      adjacent_roles: [],
      cache_misses: ["onet_soc_code"],
      ...basePayloadFields(caps, { needs_onet_map: caps.onet_configured && Boolean(targetRoleTitle) }),
    }
  }

  const adjacent = await getAdjacentRolesForUser(userId, { persistSnapshot: false })
  const compareSocCodes =
    adjacent.status === "ready"
      ? adjacent.items.slice(0, 3).map((i) => i.target_soc_code)
      : []

  const [demand, salary] = await Promise.all([
    getDemandTrajectoryForUser(userId, {
      triggerRefreshOnMiss: false,
      compareSocCodes,
    }),
    getSalaryBandsForUser(userId, { triggerRefreshOnMiss: false }),
  ])

  const cacheMisses: string[] = []
  if (adjacent.status === "cache_miss") cacheMisses.push("adjacent_roles")
  if (demand.status === "cache_miss") cacheMisses.push("demand")
  if (salary.status === "cache_miss") cacheMisses.push("salary")

  let demandIndex: number | null = null
  let demandDelta90d: string | null = null
  let demandSeries: number[] = []
  let demandEvidence: string | null = null

  if (demand.status === "ready") {
    const m90 = demand.windows.M90
    const m360 = demand.windows.M360
    demandIndex = m90?.demand_index ?? m360?.demand_index ?? null
    demandDelta90d = formatDeltaPct(m90?.demand_delta_pct)
    demandSeries = demandSeriesFromWindows(demand.windows)
    const attr = m90?.source_attribution ?? m360?.source_attribution ?? {}
    const vendors = Array.isArray(attr.vendors)
      ? (attr.vendors as string[]).join(", ")
      : typeof attr.primary_vendor === "string"
        ? attr.primary_vendor
        : "market_demand_trajectories"
    const end = m90?.window_end ?? m360?.window_end ?? ""
    demandEvidence = `${vendors} · O*NET ${demand.onet_soc_code} · ${demand.region_code}${end ? ` · window end ${end.slice(0, 10)}` : ""}`
  }

  let salaryP50: number | null = null
  let salaryEvidence: string | null = null
  let currencyCode: string | null = null
  if (salary.status === "ready") {
    const mid =
      salary.bands.find((b) => b.seniority_band === "mid") ??
      salary.current_band ??
      salary.bands[0]
    salaryP50 = mid?.salary_mid ?? null
    currencyCode = mid?.currency_code ?? null
    const attr = mid?.source_attribution
    const rule =
      attr && typeof attr === "object" && typeof attr.composition_rule === "string"
        ? attr.composition_rule
        : mid?.attribution_summary ?? "salary_bands"
    const updated = mid?.attribution_updated_at
      ? String(mid.attribution_updated_at).slice(0, 10)
      : ""
    salaryEvidence = `${rule} · O*NET ${salary.onet_soc_code} · ${salary.region_code}${updated ? ` · updated ${updated}` : ""}`
  }

  const currencySymbolVal = currencySymbol(region, currencyCode)
  const countryCodes = regionProfile?.theirstack_country_codes ?? ["GB"]

  let postingsCount: number | null = null
  let postingsEvidence: string | null = null
  const queryTitle = targetRoleTitle || currentRoleTitle
  if (caps.live_postings_vendor && queryTitle && regionProfile) {
    const live = await fetchLivePostingsCount({
      vendor: caps.live_postings_vendor,
      queryTitle,
      regionProfile,
    })
    postingsCount = live.count
    postingsEvidence = live.evidence
  }

  const adjacentRoles: MarketAdjacentRole[] = []
  if (adjacent.status === "ready") {
    const top = adjacent.items.slice(0, 6)
    for (const item of top) {
      let listings: MarketJobListing[] = []
      let listingsTotal: number | null = null
      let listingsEvidenceLine = caps.job_listings_live
        ? "TheirStack not queried (missing title)"
        : "Live employer links need TheirStack (not configured in this deployment)"

      if (caps.job_listings_live && item.target_title) {
        await delayForCareerOsVendor("theirstack")
        const listingRes = await fetchTheirStackJobListings({
          jobTitle: item.target_title,
          postedMaxAgeDays: 30,
          countryCodes,
          limit: 4,
        })
        if (listingRes.ok) {
          listings = listingRes.listings
          listingsTotal = listingRes.total_results
          listingsEvidenceLine = listingsEvidence(listingRes.attribution)
        } else {
          listingsEvidenceLine = `TheirStack error${listingRes.error ? `: ${listingRes.error.slice(0, 80)}` : ""}`
        }
      }

      adjacentRoles.push({
        target_soc_code: item.target_soc_code,
        target_title: item.target_title,
        rank_position: item.rank_position,
        fit_pct: Math.round(item.similarity_score * 100),
        bridge_skills: item.bridge_skills,
        bridge_skill_count: item.bridge_skill_count,
        salary_mid_delta_usd: item.salary_mid_delta_usd,
        salary_mid_delta_pct: item.salary_mid_delta_pct,
        demand_delta_pct_points: item.demand_delta_pct_points,
        source_salary_mid: item.source_salary_mid,
        target_salary_mid: item.target_salary_mid,
        evidence_similarity: `market_adjacent_roles · O*NET ${adjacent.source_soc_code} → ${item.target_soc_code} · rank ${item.rank_position} · demand+salary similarity v1`,
        listings,
        listings_total: listingsTotal,
        evidence_listings: listingsEvidenceLine,
      })
    }
  }

  const hasAnyData =
    adjacent.status === "ready" ||
    demand.status === "ready" ||
    salary.status === "ready" ||
    postingsCount != null

  return {
    status: hasAnyData ? "ready" : cacheMisses.length ? "empty" : "profile_incomplete",
    current_role_title: currentRoleTitle,
    target_role_title: targetRoleTitle,
    source_soc_code: soc,
    region_code: region,
    region_label: regionProfile?.label ?? region,
    currency_symbol: currencySymbolVal,
    demand_index: demandIndex,
    demand_delta_90d: demandDelta90d,
    demand_series: demandSeries,
    demand_evidence: demandEvidence,
    postings_count: postingsCount,
    postings_evidence: postingsEvidence,
    salary_p50: salaryP50,
    salary_evidence: salaryEvidence,
    current_salary_mid:
      typeof profile?.current_salary_usd === "number"
        ? profile.current_salary_usd
        : salary.status === "ready"
          ? (salary.current_band?.salary_mid ?? salary.bands.find((b) => b.seniority_band === "mid")?.salary_mid ?? null)
          : null,
    adjacent_status:
      adjacent.status === "ready"
        ? "ready"
        : adjacent.status === "cache_miss"
          ? "cache_miss"
          : "profile_incomplete",
    adjacent_roles: adjacentRoles,
    cache_misses: cacheMisses,
    ...basePayloadFields(caps),
  }
}

export { formatUsd }
