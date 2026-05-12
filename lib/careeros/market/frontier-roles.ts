import { supabaseAdmin } from "@/lib/supabase"
import type { AdjacentRolesForUserResult } from "@/lib/careeros/market/adjacent-roles"
import { fetchTheirStackJobCount } from "@/lib/careeros/integrations/theirstack-job-count"
import { fetchTheirStackFrontierExample } from "@/lib/careeros/integrations/theirstack-frontier-example"
import { delayForCareerOsVendor } from "@/lib/careeros/integrations/rate-limits"
import {
  DEMAND_TOP_REGIONS,
  getDemandRegionProfile,
  matchUserRegionToDemandRegion,
} from "@/lib/careeros/market/demand-regions"
import {
  FRONTIER_ROLE_CLUSTERS,
  type FrontierRoleClusterSeed,
} from "@/lib/careeros/market/frontier-role-seed"
import { FRONTIER_ROLES_DATASET_VERSION } from "@/lib/careeros/market/frontier-role-version"

export type FrontierRoleItem = {
  clusterSlug: string
  canonicalTitle: string
  aliases: string[]
  theirstackQueryTitle: string
  /** Earliest monthly snapshot period (UTC month start) with enough volume in our history. */
  firstSeenPeriod: string | null
  count30d: number
  growthVsPriorPeriodPct: number | null
  examplePostingTitle: string | null
  examplePostingUrl: string | null
}

const MIN_COUNT_FOR_FIRST_SEEN = 2

/** Calendar month start, UTC (YYYY-MM-01). */
export function monthStartUtc(from: Date): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
}

function dateIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonths(d: Date, delta: number): Date {
  const x = new Date(d)
  x.setUTCMonth(x.getUTCMonth() + delta)
  return x
}

function seedBySlug(): Map<string, FrontierRoleClusterSeed> {
  return new Map(FRONTIER_ROLE_CLUSTERS.map((c) => [c.slug, c]))
}

function clusterMatchesUserRelates(
  cluster: FrontierRoleClusterSeed,
  relatePrefixes: Set<string>,
  userSkills: Set<string>,
): boolean {
  const prefixHit = cluster.onetMajorPrefixes.some((p) => relatePrefixes.has(p))
  if (prefixHit) return true
  if (!cluster.skillHints?.length) return false
  return cluster.skillHints.some((k) => userSkills.has(k.toLowerCase()))
}

export async function refreshMarketFrontierRoleSnapshots(options?: { regionCodes?: string[] }) {
  const tsKey = process.env.THEIRSTACK_API_KEY?.trim()
  const periodStart = monthStartUtc(new Date())
  const periodIso = dateIso(periodStart)
  const prevPeriodIso = dateIso(addMonths(periodStart, -1))

  if (!tsKey) {
    return { snapshot_period: periodIso, rows: 0, errors: ["missing_theirstack_api_key"] }
  }

  const regionProfiles = options?.regionCodes?.length
    ? options.regionCodes.map((c) => getDemandRegionProfile(c)).filter((r): r is NonNullable<typeof r> => Boolean(r))
    : [...DEMAND_TOP_REGIONS]

  const { data: priorRows, error: priorErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_frontier_role_weekly")
    .select("cluster_slug,region_code,count_30d")
    .eq("snapshot_week", prevPeriodIso)
  if (priorErr) throw priorErr

  const priorMap = new Map<string, number>()
  for (const row of priorRows ?? []) {
    priorMap.set(`${String(row.cluster_slug)}|${String(row.region_code)}`, Number(row.count_30d ?? 0))
  }

  const startedAt = new Date().toISOString()
  const insertRows: Record<string, unknown>[] = []
  const errors: string[] = []

  for (const profile of regionProfiles) {
    const regionCode = profile.region_code
    for (const cluster of FRONTIER_ROLE_CLUSTERS) {
      await delayForCareerOsVendor("theirstack")
      const r = await fetchTheirStackJobCount({
        jobTitles: [cluster.theirstackQueryTitle],
        postedMaxAgeDays: 30,
        countryCodes: profile.theirstack_country_codes,
      })
      const key = `${cluster.slug}|${regionCode}`
      const prior = priorMap.has(key) ? priorMap.get(key)! : null
      const count30 = r.ok && typeof r.totalResults === "number" ? r.totalResults : 0
      if (!r.ok) {
        errors.push(`${key}:count:${r.error ?? String(r.status)}`)
      }
      let growth: number | null = null
      if (prior != null && prior > 0) {
        growth = Number((((count30 - prior) / prior) * 100).toFixed(2))
      }

      await delayForCareerOsVendor("theirstack")
      const ex = await fetchTheirStackFrontierExample({
        jobTitle: cluster.theirstackQueryTitle,
        postedMaxAgeDays: 90,
        countryCodes: profile.theirstack_country_codes,
      })
      if (!ex.ok) {
        errors.push(`${key}:example:${ex.error ?? "unknown"}`)
      }

      insertRows.push({
        cluster_slug: cluster.slug,
        canonical_title: cluster.canonicalTitle,
        region_code: regionCode,
        snapshot_week: periodIso,
        count_30d: count30,
        prior_week_count_30d: prior,
        growth_vs_prior_week_pct: growth,
        example_posting_title: ex.title ?? null,
        example_posting_url: ex.url ?? null,
        source_dataset_version: FRONTIER_ROLES_DATASET_VERSION,
        source_attribution: {
          vendor: "theirstack",
          posted_at_max_age_days: 30,
          example_posted_max_age_days: 90,
          query_title: cluster.theirstackQueryTitle,
          count_ok: r.ok,
          example_ok: ex.ok,
        },
      })
    }
  }

  if (insertRows.length) {
    const { error: upErr } = await supabaseAdmin
      .schema("careeros")
      .from("market_frontier_role_weekly")
      .upsert(insertRows, { onConflict: "cluster_slug,region_code,snapshot_week" })
    if (upErr) throw upErr
  }

  const windowEnd = new Date()
  const freshStart = addMonths(periodStart, -1)
  const freshness = `[${dateIso(freshStart)},${dateIso(windowEnd)}]`

  await supabaseAdmin.schema("careeros").from("cache_refresh_runs").insert({
    dataset_key: "market_frontier_role_weekly",
    workflow_name: "careeros-frontier-roles-monthly",
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    status: errors.length ? "completed_with_errors" : "completed",
    rows_processed: insertRows.length,
    rows_inserted: insertRows.length,
    rows_updated: 0,
    rows_skipped: 0,
    data_source_version: FRONTIER_ROLES_DATASET_VERSION,
    freshness_window: freshness,
    run_stats: {
      snapshot_period: periodIso,
      regions: regionProfiles.map((p) => p.region_code),
      errors: errors.slice(0, 40),
    },
    source_attribution: { vendor: "theirstack" },
  })

  return { snapshot_period: periodIso, rows: insertRows.length, errors }
}

export async function getFrontierRolesForUser(
  userId: string,
  options?: { adjacent?: AdjacentRolesForUserResult },
) {
  const { data: profile, error: pErr } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("onet_soc_code,location_region_code")
    .eq("user_id", userId)
    .maybeSingle()
  if (pErr) throw pErr
  const soc = (profile?.onet_soc_code as string | null)?.trim()
  if (!soc) {
    return { status: "profile_incomplete" as const, reason: "missing_onet_soc_code" }
  }

  const regionRaw = (profile?.location_region_code as string | null)?.trim() || null
  const region = matchUserRegionToDemandRegion(regionRaw) || regionRaw
  if (!region || !getDemandRegionProfile(region)) {
    return { status: "profile_incomplete" as const, reason: "missing_or_unknown_market_region" }
  }

  const { data: userSkillRows } = await supabaseAdmin
    .schema("careeros")
    .from("user_skills")
    .select("canonical_skill_key")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(300)
  const userSkills = new Set(
    (userSkillRows ?? [])
      .map((r) => String(r.canonical_skill_key ?? "").trim().toLowerCase())
      .filter((k) => k.length > 0),
  )

  const relatePrefixes = new Set<string>()
  relatePrefixes.add(soc.slice(0, 2))
  const adjacent = options?.adjacent
  if (adjacent?.status === "ready") {
    for (const item of adjacent.items.slice(0, 10)) {
      relatePrefixes.add(item.target_soc_code.slice(0, 2))
    }
  }

  const { data: latestRow } = await supabaseAdmin
    .schema("careeros")
    .from("market_frontier_role_weekly")
    .select("snapshot_week")
    .eq("region_code", region)
    .eq("source_dataset_version", FRONTIER_ROLES_DATASET_VERSION)
    .order("snapshot_week", { ascending: false })
    .limit(1)
    .maybeSingle()

  const latestPeriod = latestRow?.snapshot_week as string | undefined
  if (!latestPeriod) {
    return { status: "cache_miss" as const, region_code: region, source_soc_code: soc }
  }

  const { data: periodRows, error: wErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_frontier_role_weekly")
    .select(
      "cluster_slug,canonical_title,count_30d,growth_vs_prior_week_pct,snapshot_week,example_posting_title,example_posting_url",
    )
    .eq("region_code", region)
    .eq("snapshot_week", latestPeriod)
    .eq("source_dataset_version", FRONTIER_ROLES_DATASET_VERSION)
  if (wErr) throw wErr
  if (!periodRows?.length) {
    return { status: "cache_miss" as const, region_code: region, source_soc_code: soc }
  }

  const { data: historyRows } = await supabaseAdmin
    .schema("careeros")
    .from("market_frontier_role_weekly")
    .select("cluster_slug,snapshot_week,count_30d")
    .eq("region_code", region)
    .eq("source_dataset_version", FRONTIER_ROLES_DATASET_VERSION)
    .gte("count_30d", MIN_COUNT_FOR_FIRST_SEEN)

  const firstSeenBySlug = new Map<string, string>()
  for (const row of historyRows ?? []) {
    const slug = String(row.cluster_slug)
    const w = String(row.snapshot_week)
    const prev = firstSeenBySlug.get(slug)
    if (!prev || w < prev) firstSeenBySlug.set(slug, w)
  }

  const seeds = seedBySlug()
  const ranked: FrontierRoleItem[] = []
  for (const row of periodRows) {
    const slug = String(row.cluster_slug)
    const seed = seeds.get(slug)
    if (!seed) continue
    if (!clusterMatchesUserRelates(seed, relatePrefixes, userSkills)) continue
    const exTitle = (row.example_posting_title as string | null)?.trim() || null
    const exUrl = (row.example_posting_url as string | null)?.trim() || null
    ranked.push({
      clusterSlug: slug,
      canonicalTitle: seed.canonicalTitle,
      aliases: seed.aliases,
      theirstackQueryTitle: seed.theirstackQueryTitle,
      firstSeenPeriod: firstSeenBySlug.get(slug) ?? null,
      count30d: Number(row.count_30d ?? 0),
      growthVsPriorPeriodPct:
        row.growth_vs_prior_week_pct == null ? null : Number(row.growth_vs_prior_week_pct),
      examplePostingTitle: exTitle,
      examplePostingUrl: exUrl,
    })
  }

  ranked.sort((a, b) => {
    const ga = a.growthVsPriorPeriodPct ?? -1e9
    const gb = b.growthVsPriorPeriodPct ?? -1e9
    if (gb !== ga) return gb - ga
    return b.count30d - a.count30d
  })

  const items = ranked.slice(0, 10)

  return {
    status: "ready" as const,
    region_code: region,
    source_soc_code: soc,
    snapshot_period: latestPeriod,
    items,
    footnote:
      "First seen is the earliest monthly snapshot in our data where volume crossed a small floor, not a claim about the first job ever posted. Growth compares this month's 30 day rolling count to the prior month's snapshot. Example jobs come from the same TheirStack search (one row) and may rotate between refreshes.",
  }
}

export type FrontierRolesForUserResult = Awaited<ReturnType<typeof getFrontierRolesForUser>>
