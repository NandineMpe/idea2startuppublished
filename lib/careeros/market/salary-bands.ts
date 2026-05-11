import { delayForCareerOsVendor } from "@/lib/careeros/integrations/rate-limits"
import { fetchAdzunaSalarySamples } from "@/lib/careeros/integrations/adzuna-salary-samples"
import { fetchJSearchSalarySamples } from "@/lib/careeros/integrations/jsearch-salary-samples"
import {
  getDemandRegionProfile,
  matchUserRegionToDemandRegion,
  type DemandRegionProfile,
} from "@/lib/careeros/market/demand-regions"
import { resolveOccupationTitleForSoc } from "@/lib/careeros/market/demand-compose"
import {
  SALARY_SENIORITY_BANDS,
  SALARY_SOURCE_DATASET_VERSION,
  type SalarySeniorityBand,
} from "@/lib/careeros/market/salary-version"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import { supabaseAdmin } from "@/lib/supabase"

type SalaryStats = {
  min: number
  mid: number
  max: number
}

type SalarySourceAttribution = {
  composition_rule: string
  adzuna: Record<string, unknown>
  jsearch: Record<string, unknown>
  is_partial: boolean
  caveats: string[]
}

const HIGH_VALUE_SPECIALISATIONS = [
  { key: "machine-learning", label: "Machine Learning", deltaPct: 0.18 },
  { key: "ai-llm", label: "AI / LLM", deltaPct: 0.22 },
  { key: "cloud-architecture", label: "Cloud Architecture", deltaPct: 0.14 },
  { key: "cybersecurity", label: "Cybersecurity", deltaPct: 0.16 },
  { key: "data-engineering", label: "Data Engineering", deltaPct: 0.15 },
] as const

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  if (sorted.length === 1) return sorted[0]!
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]!
  const w = idx - lo
  return sorted[lo]! * (1 - w) + sorted[hi]! * w
}

function deriveSalaryStats(values: number[]): SalaryStats {
  const cleaned = values.filter((v) => Number.isFinite(v) && v > 1_000).sort((a, b) => a - b)
  if (!cleaned.length) {
    return { min: 0, mid: 0, max: 0 }
  }
  return {
    min: Math.round(percentile(cleaned, 0.15)),
    mid: Math.round(percentile(cleaned, 0.5)),
    max: Math.round(percentile(cleaned, 0.85)),
  }
}

function bandAdjustments(base: SalaryStats): Record<SalarySeniorityBand, SalaryStats> {
  const mult = {
    junior: { min: 0.8, mid: 0.85, max: 0.9 },
    mid: { min: 0.95, mid: 1.0, max: 1.05 },
    senior: { min: 1.15, mid: 1.2, max: 1.3 },
  } as const

  const out = {} as Record<SalarySeniorityBand, SalaryStats>
  for (const b of SALARY_SENIORITY_BANDS) {
    out[b] = {
      min: Math.round(base.min * mult[b].min),
      mid: Math.round(base.mid * mult[b].mid),
      max: Math.round(base.max * mult[b].max),
    }
  }
  return out
}

export async function refreshSalaryBandsCombo(params: {
  onetSocCode: string
  occupationTitle: string
  region: DemandRegionProfile
}): Promise<{ rowsWritten: number; sourceAttribution: SalarySourceAttribution }> {
  const title = params.occupationTitle.trim() || params.onetSocCode

  await delayForCareerOsVendor("adzuna")
  const adzuna = await fetchAdzunaSalarySamples({
    country: params.region.adzuna_country,
    keywords: title,
    resultsPerPage: 30,
  })

  await delayForCareerOsVendor("jsearch")
  const jsearch = await fetchJSearchSalarySamples({
    query: title,
    location: params.region.jsearch_location,
  })

  const all = [...adzuna.salaries, ...jsearch.salaries]
  const base = deriveSalaryStats(all)
  if (base.mid <= 0) {
    return {
      rowsWritten: 0,
      sourceAttribution: {
        composition_rule: "adzuna_samples_plus_jsearch_samples_percentile_blend",
        adzuna: { ok: adzuna.ok, status: adzuna.status, sample_size: adzuna.sampleSize },
        jsearch: { ok: jsearch.ok, status: jsearch.status, sample_size: jsearch.sampleSize },
        is_partial: true,
        caveats: ["no_salary_samples_found_for_combo"],
      },
    }
  }

  const byBand = bandAdjustments(base)
  const sourceAttribution: SalarySourceAttribution = {
    composition_rule: "adzuna_samples_plus_jsearch_samples_percentile_blend",
    adzuna: { ok: adzuna.ok, status: adzuna.status, sample_size: adzuna.sampleSize },
    jsearch: { ok: jsearch.ok, status: jsearch.status, sample_size: jsearch.sampleSize },
    is_partial: !(adzuna.ok && jsearch.ok),
    caveats: [
      "salary_counts_are_not_cost_of_living_normalised",
      "cross_country_comparison_requires_user_context",
    ],
  }

  const rows = SALARY_SENIORITY_BANDS.map((band) => ({
    onet_soc_code: params.onetSocCode,
    seniority_band: band,
    region_code: params.region.region_code,
    currency_code: "USD",
    salary_min: byBand[band].min,
    salary_mid: byBand[band].mid,
    salary_max: byBand[band].max,
    sample_size: adzuna.sampleSize + jsearch.sampleSize,
    source_dataset_version: SALARY_SOURCE_DATASET_VERSION,
    source_attribution: sourceAttribution,
  }))

  const { error } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .upsert(rows, {
      onConflict: "onet_soc_code,seniority_band,region_code,source_dataset_version",
    })

  if (error) {
    throw new Error(error.message)
  }

  const { data: writtenBands, error: bandReadErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .select("id,salary_min,salary_mid,salary_max")
    .eq("onet_soc_code", params.onetSocCode)
    .eq("region_code", params.region.region_code)
    .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)
    .limit(10)
  if (bandReadErr) throw new Error(bandReadErr.message)

  const overlayRows =
    writtenBands?.flatMap((band) =>
      HIGH_VALUE_SPECIALISATIONS.map((s) => {
        const mid = typeof band.salary_mid === "number" ? band.salary_mid : null
        return {
          market_salary_band_id: band.id as string,
          overlay_skill_key: s.key,
          delta_pct: s.deltaPct,
          salary_min_override: Math.round(Number(band.salary_min) * (1 + s.deltaPct)),
          salary_mid_override: mid == null ? null : Math.round(mid * (1 + s.deltaPct)),
          salary_max_override: Math.round(Number(band.salary_max) * (1 + s.deltaPct)),
          source_dataset_version: SALARY_SOURCE_DATASET_VERSION,
          source_attribution: {
            seeded_overlay: true,
            label: s.label,
            methodology: "static_high_value_specialisation_uplift_v1",
          },
        }
      }),
    ) ?? []

  if (overlayRows.length) {
    const { error: overlayErr } = await supabaseAdmin
      .schema("careeros")
      .from("market_salary_band_overlays")
      .upsert(overlayRows, {
        onConflict: "market_salary_band_id,overlay_skill_key,source_dataset_version",
      })
    if (overlayErr) throw new Error(overlayErr.message)
  }

  return { rowsWritten: rows.length, sourceAttribution }
}

export type UserSalaryBandsResult =
  | {
      status: "ready"
      onet_soc_code: string
      region_code: string
      occupation_title: string | null
      years_experience: number | null
      current_salary_usd: number | null
      inferred_seniority_band: SalarySeniorityBand
      current_band: {
        seniority_band: string
        salary_min: number
        salary_mid: number | null
        salary_max: number
        currency_code: string
      } | null
      current_vs_market_mid_delta_pct: number | null
      delta_uses_actual_salary: boolean
      bands: Array<{
        seniority_band: string
        currency_code: string
        salary_min: number
        salary_mid: number | null
        salary_max: number
        sample_size: number | null
        attribution_summary: string
        attribution_updated_at: string | null
        is_seeded_data: boolean
        source_attribution: Record<string, unknown>
      }>
      overlays: Array<{
        specialisation_key: string
        specialisation_label: string
        delta_pct: number | null
        salary_mid_override: number | null
      }>
    }
  | {
      status: "profile_incomplete"
      onet_soc_code: string | null
      region_code: string | null
    }
  | {
      status: "cache_miss"
      onet_soc_code: string
      region_code: string
      refresh_requested: boolean
    }

function inferSeniorityBand(yearsExperience: number | null): SalarySeniorityBand {
  if (yearsExperience == null || Number.isNaN(yearsExperience)) return "mid"
  if (yearsExperience < 3) return "junior"
  if (yearsExperience < 8) return "mid"
  return "senior"
}

export async function getSalaryBandsForUser(userId: string): Promise<UserSalaryBandsResult> {
  const { data: profile, error } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("onet_soc_code,location_region_code,current_role_title,years_experience,current_salary_usd")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const onet = (profile?.onet_soc_code as string | null)?.trim() || null
  const regionRaw = (profile?.location_region_code as string | null)?.trim() || null
  const region = matchUserRegionToDemandRegion(regionRaw) || regionRaw

  if (!onet || !region) {
    return { status: "profile_incomplete", onet_soc_code: onet, region_code: region }
  }

  const { data: rows, error: rowsError } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .select(
      "id,seniority_band,currency_code,salary_min,salary_mid,salary_max,sample_size,source_attribution,updated_at",
    )
    .eq("onet_soc_code", onet)
    .eq("region_code", region)
    .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)
    .order("seniority_band", { ascending: true })

  if (rowsError) throw new Error(rowsError.message)

  if (!rows?.length) {
    await sendCareerOSEvent({
      name: "careeros/market.refresh-salary",
      data: { soc_codes: [onet], region_codes: [region], max_combos: 1, offset: 0 },
    })
    return {
      status: "cache_miss",
      onet_soc_code: onet,
      region_code: region,
      refresh_requested: true,
    }
  }

  const occupation_title = (profile?.current_role_title as string | null) || (await resolveOccupationTitleForSoc(onet))
  const yearsExperience =
    typeof profile?.years_experience === "number" ? Number(profile.years_experience) : null
  const currentSalaryUsd =
    typeof profile?.current_salary_usd === "number" ? Number(profile.current_salary_usd) : null
  const inferredSeniority = inferSeniorityBand(yearsExperience)

  const bandIds = (rows ?? []).map((r) => (r as { id?: string }).id).filter((x): x is string => Boolean(x))
  const { data: overlayRows, error: overlayErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_band_overlays")
    .select("overlay_skill_key,delta_pct,salary_mid_override,source_attribution")
    .in("market_salary_band_id", bandIds.length ? bandIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)
    .limit(200)
  if (overlayErr) throw new Error(overlayErr.message)

  const overlayByKey = new Map<
    string,
    { specialisation_key: string; specialisation_label: string; delta_pct: number | null; salary_mid_override: number | null }
  >()
  for (const o of overlayRows ?? []) {
    const key = String(o.overlay_skill_key)
    const existing = overlayByKey.get(key)
    if (existing) continue
    const label =
      HIGH_VALUE_SPECIALISATIONS.find((s) => s.key === key)?.label ??
      key
        .split("-")
        .map((p) => p[0]?.toUpperCase() + p.slice(1))
        .join(" ")
    overlayByKey.set(key, {
      specialisation_key: key,
      specialisation_label: label,
      delta_pct: typeof o.delta_pct === "number" ? o.delta_pct : null,
      salary_mid_override: typeof o.salary_mid_override === "number" ? o.salary_mid_override : null,
    })
  }

  const normalizedBands = (rows ?? []).map((r) => ({
    ...(function () {
      const sa =
        r.source_attribution && typeof r.source_attribution === "object"
          ? (r.source_attribution as Record<string, unknown>)
          : {}
      const adz = sa.adzuna && typeof sa.adzuna === "object" ? (sa.adzuna as Record<string, unknown>) : {}
      const js = sa.jsearch && typeof sa.jsearch === "object" ? (sa.jsearch as Record<string, unknown>) : {}
      const adzN = typeof adz.sample_size === "number" ? adz.sample_size : 0
      const jsN = typeof js.sample_size === "number" ? js.sample_size : 0
      const total = Math.max(1, adzN + jsN)
      const isSeeded = Boolean(sa.seeded)
      const summary = isSeeded
        ? "Source: seeded data (deterministic backfill)"
        : `Sources: Adzuna ${Math.round((adzN / total) * 100)}%, JSearch ${Math.round((jsN / total) * 100)}%`
      return {
        source_attribution: sa,
        attribution_summary: summary,
        attribution_updated_at: r.updated_at == null ? null : String(r.updated_at),
        is_seeded_data: isSeeded,
      }
    })(),
    seniority_band: String(r.seniority_band),
    currency_code: String(r.currency_code),
    salary_min: Number(r.salary_min),
    salary_mid: r.salary_mid == null ? null : Number(r.salary_mid),
    salary_max: Number(r.salary_max),
    sample_size: r.sample_size == null ? null : Number(r.sample_size),
  }))

  const currentBand = normalizedBands.find((b) => b.seniority_band === inferredSeniority) ?? null
  const marketMidBand = normalizedBands.find((b) => b.seniority_band === "mid") ?? null
  const baseline =
    currentSalaryUsd != null
      ? currentSalaryUsd
      : currentBand?.salary_mid != null
        ? currentBand.salary_mid
        : null
  const currentVsMarketMidDeltaPct =
    baseline != null && marketMidBand?.salary_mid != null && marketMidBand.salary_mid > 0
      ? Number((((baseline - marketMidBand.salary_mid) / marketMidBand.salary_mid) * 100).toFixed(1))
      : null

  return {
    status: "ready",
    onet_soc_code: onet,
    region_code: region,
    occupation_title,
    years_experience: yearsExperience,
    current_salary_usd: currentSalaryUsd,
    inferred_seniority_band: inferredSeniority,
    current_band: currentBand
      ? {
          seniority_band: currentBand.seniority_band,
          salary_min: currentBand.salary_min,
          salary_mid: currentBand.salary_mid,
          salary_max: currentBand.salary_max,
          currency_code: currentBand.currency_code,
        }
      : null,
    current_vs_market_mid_delta_pct: currentVsMarketMidDeltaPct,
    delta_uses_actual_salary: currentSalaryUsd != null,
    bands: normalizedBands,
    overlays: [...overlayByKey.values()]
      .sort((a, b) => (b.delta_pct ?? 0) - (a.delta_pct ?? 0))
      .slice(0, 5),
  }
}

export async function resolveRegionProfiles(regionCodes: string[]): Promise<DemandRegionProfile[]> {
  return regionCodes
    .map((code) => getDemandRegionProfile(code))
    .filter((x): x is DemandRegionProfile => Boolean(x))
}
