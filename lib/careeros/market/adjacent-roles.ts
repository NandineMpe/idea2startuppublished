import { randomUUID } from "crypto"
import { DEMAND_TOP_50_SOCS } from "@/lib/careeros/market/demand-soc-list"
import { matchUserRegionToDemandRegion } from "@/lib/careeros/market/demand-regions"
import { ADJACENT_ROLES_SOURCE_DATASET_VERSION } from "@/lib/careeros/market/adjacent-version"
import { supabaseAdmin } from "@/lib/supabase"

type DemandPoint = {
  onet_soc_code: string
  region_code: string
  demand_index: number | null
  velocity_score: number | null
}

type SalaryPoint = {
  onet_soc_code: string
  region_code: string
  p50: number | null
}

const GENERIC_SKILL_KEYS = new Set([
  "communication",
  "teamwork",
  "leadership",
  "problem-solving",
  "critical-thinking",
  "time-management",
])

function inferTargetRoleSkills(targetSoc: string): string[] {
  const family = socPrefix(targetSoc)
  if (family === "15") {
    return [
      "python",
      "typescript",
      "sql",
      "cloud-architecture",
      "kubernetes",
      "machine-learning",
      "ai-llm",
      "data-engineering",
    ]
  }
  if (family === "11") {
    return [
      "product-strategy",
      "experimentation",
      "data-analysis",
      "stakeholder-management",
      "go-to-market",
      "roadmapping",
    ]
  }
  if (family === "13") {
    return [
      "financial-modeling",
      "sql",
      "forecasting",
      "risk-analysis",
      "dashboarding",
      "excel-modeling",
    ]
  }
  if (family === "29") {
    return [
      "clinical-protocols",
      "patient-care",
      "healthcare-it",
      "triage",
      "care-coordination",
    ]
  }
  return ["sql", "data-analysis", "project-management", "domain-expertise", "automation"]
}

function prettySkillLabel(skillKey: string): string {
  return skillKey
    .split("-")
    .map((p) => (p ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(" ")
}

type AdjacentPersonalisation = {
  bridgeSkills: string[]
  targetSalary: number | null
  targetDemand: number | null
  salaryDeltaUsd: number | null
  salaryDeltaPct: number | null
  demandDeltaPctPoints: number | null
}

function buildAdjacentPersonalisation(args: {
  targetSocCode: string
  userSkills: Set<string>
  salaryMidBySoc: Map<string, number>
  demandDeltaBySoc: Map<string, number>
  sourceMidSalary: number | null
  sourceDemandDelta: number | null
}): AdjacentPersonalisation {
  const targetSoc = String(args.targetSocCode)
  const targetSkills = inferTargetRoleSkills(targetSoc)
  const bridgeSkills = targetSkills
    .filter((k) => !args.userSkills.has(k))
    .filter((k) => !GENERIC_SKILL_KEYS.has(k))
    .slice(0, 5)
  const targetSalary = args.salaryMidBySoc.get(targetSoc) ?? null
  const targetDemand = args.demandDeltaBySoc.get(targetSoc) ?? null
  const salaryDeltaUsd =
    targetSalary != null && args.sourceMidSalary != null
      ? Math.round(targetSalary - args.sourceMidSalary)
      : null
  const salaryDeltaPct =
    targetSalary != null && args.sourceMidSalary != null && args.sourceMidSalary > 0
      ? Number((((targetSalary - args.sourceMidSalary) / args.sourceMidSalary) * 100).toFixed(1))
      : null
  const demandDeltaPctPoints =
    targetDemand != null && args.sourceDemandDelta != null
      ? Number((targetDemand - args.sourceDemandDelta).toFixed(1))
      : null
  return {
    bridgeSkills,
    targetSalary,
    targetDemand,
    salaryDeltaUsd,
    salaryDeltaPct,
    demandDeltaPctPoints,
  }
}

function socPrefix(soc: string): string {
  return soc.slice(0, 2)
}

function safeNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function normDelta(a: number | null, b: number | null): number {
  if (a == null || b == null) return 0
  const denom = Math.max(1, Math.abs(a), Math.abs(b))
  return Math.min(1, Math.abs(a - b) / denom)
}

function scorePair(params: {
  source: string
  target: string
  demandBySoc: Map<string, DemandPoint[]>
  salaryBySoc: Map<string, SalaryPoint[]>
}): { score: number; explain: Record<string, unknown> } {
  const sourceDemand = params.demandBySoc.get(params.source) ?? []
  const targetDemand = params.demandBySoc.get(params.target) ?? []
  const sourceSalary = params.salaryBySoc.get(params.source) ?? []
  const targetSalary = params.salaryBySoc.get(params.target) ?? []

  const demandMap = new Map(sourceDemand.map((d) => [d.region_code, d]))
  const targetDemandMap = new Map(targetDemand.map((d) => [d.region_code, d]))
  const salaryMap = new Map(sourceSalary.map((s) => [s.region_code, s]))
  const targetSalaryMap = new Map(targetSalary.map((s) => [s.region_code, s]))

  const regions = new Set([
    ...[...demandMap.keys()],
    ...[...targetDemandMap.keys()],
    ...[...salaryMap.keys()],
    ...[...targetSalaryMap.keys()],
  ])

  let demandPenalty = 0
  let salaryPenalty = 0
  let n = 0
  for (const r of regions) {
    const sd = demandMap.get(r)
    const td = targetDemandMap.get(r)
    const ss = salaryMap.get(r)
    const ts = targetSalaryMap.get(r)
    demandPenalty += normDelta(sd?.demand_index ?? null, td?.demand_index ?? null)
    demandPenalty += normDelta(sd?.velocity_score ?? null, td?.velocity_score ?? null)
    salaryPenalty += normDelta(ss?.p50 ?? null, ts?.p50 ?? null)
    n += 3
  }

  const sameFamily = socPrefix(params.source) === socPrefix(params.target) ? 1 : 0
  const base = sameFamily ? 0.55 : 0.25
  const demandComponent = n > 0 ? 1 - demandPenalty / n : 0.4
  const salaryComponent = n > 0 ? 1 - salaryPenalty / n : 0.4

  const score = Math.max(
    0,
    Math.min(1, base * 0.45 + demandComponent * 0.35 + salaryComponent * 0.2),
  )

  return {
    score: Number(score.toFixed(5)),
    explain: {
      same_soc_family: Boolean(sameFamily),
      demand_component: Number(demandComponent.toFixed(5)),
      salary_component: Number(salaryComponent.toFixed(5)),
    },
  }
}

async function loadDemandPoints(): Promise<Map<string, DemandPoint[]>> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_demand_trajectories")
    .select("onet_soc_code,region_code,demand_index,demand_delta_pct")
    .eq("window_code", "M360")
    .limit(20000)
  if (error) throw error
  const m = new Map<string, DemandPoint[]>()
  for (const row of data ?? []) {
    const soc = String(row.onet_soc_code)
    const arr = m.get(soc) ?? []
    arr.push({
      onet_soc_code: soc,
      region_code: String(row.region_code),
      demand_index: safeNum(row.demand_index),
      velocity_score: safeNum(row.demand_delta_pct),
    })
    m.set(soc, arr)
  }
  return m
}

async function loadSalaryPoints(): Promise<Map<string, SalaryPoint[]>> {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_salary_bands")
    .select("onet_soc_code,region_code,salary_mid")
    .eq("seniority_band", "mid")
    .limit(20000)
  if (error) throw error
  const m = new Map<string, SalaryPoint[]>()
  for (const row of data ?? []) {
    const soc = String(row.onet_soc_code)
    const arr = m.get(soc) ?? []
    arr.push({
      onet_soc_code: soc,
      region_code: String(row.region_code),
      p50: safeNum(row.salary_mid),
    })
    m.set(soc, arr)
  }
  return m
}

export async function refreshMarketAdjacentRoles(options?: {
  sourceSocCodes?: string[]
  topK?: number
}) {
  const sources = options?.sourceSocCodes?.length
    ? options.sourceSocCodes
    : [...DEMAND_TOP_50_SOCS]
  const topK = Math.max(3, Math.min(12, options?.topK ?? 8))

  const [demandBySoc, salaryBySoc] = await Promise.all([
    loadDemandPoints(),
    loadSalaryPoints(),
  ])

  const rows: Array<Record<string, unknown>> = []
  for (const source of sources) {
    const scored: Array<{ soc: string; score: number; explain: Record<string, unknown> }> = []
    for (const target of DEMAND_TOP_50_SOCS) {
      if (target === source) continue
      const r = scorePair({ source, target, demandBySoc, salaryBySoc })
      scored.push({ soc: target, score: r.score, explain: r.explain })
    }
    scored.sort((a, b) => b.score - a.score)
    const top = scored.slice(0, topK)
    top.forEach((t, idx) => {
      rows.push({
        source_soc_code: source,
        target_soc_code: t.soc,
        similarity_method: "demand_salary_soc_family_v1",
        similarity_score: t.score,
        rank_position: idx + 1,
        source_dataset_version: ADJACENT_ROLES_SOURCE_DATASET_VERSION,
        explain_payload: t.explain,
      })
    })
  }

  if (rows.length) {
    const { error } = await supabaseAdmin
      .schema("careeros")
      .from("market_adjacent_roles")
      .upsert(rows, {
        onConflict:
          "source_soc_code,target_soc_code,similarity_method,source_dataset_version",
      })
    if (error) throw error
  }

  return { rows_written: rows.length, source_count: sources.length, top_k: topK }
}

export async function getAdjacentRolesForUser(userId: string) {
  const { data: profile, error: pErr } = await supabaseAdmin
    .schema("careeros")
    .from("user_profiles")
    .select("onet_soc_code,location_region_code")
    .eq("user_id", userId)
    .maybeSingle()
  if (pErr) throw pErr
  const soc = (profile?.onet_soc_code as string | null)?.trim()
  const regionRaw = (profile?.location_region_code as string | null)?.trim() || null
  const region = matchUserRegionToDemandRegion(regionRaw) || regionRaw
  if (!soc) return { status: "profile_incomplete" as const, reason: "missing_onet_soc_code" }

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

  const { data: marketRows, error: mErr } = await supabaseAdmin
    .schema("careeros")
    .from("market_adjacent_roles")
    .select("id,target_soc_code,rank_position,similarity_score,explain_payload")
    .eq("source_soc_code", soc)
    .eq("source_dataset_version", ADJACENT_ROLES_SOURCE_DATASET_VERSION)
    .order("rank_position", { ascending: true })
    .limit(12)
  if (mErr) throw mErr

  if (!marketRows?.length) {
    return { status: "cache_miss" as const, source_soc_code: soc }
  }

  const targetSocs = marketRows.map((r) => String(r.target_soc_code))
  const allSocs = [soc, ...targetSocs]
  const { data: occRows } = await supabaseAdmin
    .schema("careeros")
    .from("onet_occupations_cache")
    .select("onet_soc_code,title")
    .in("onet_soc_code", targetSocs)
    .limit(50)

  const occBySoc = new Map<string, string>()
  for (const row of occRows ?? []) {
    occBySoc.set(String(row.onet_soc_code), String(row.title ?? row.onet_soc_code))
  }

  const salaryMidBySoc = new Map<string, number>()
  const demandDeltaBySoc = new Map<string, number>()
  if (region) {
    const { data: salaryRows } = await supabaseAdmin
      .schema("careeros")
      .from("market_salary_bands")
      .select("onet_soc_code,salary_mid")
      .eq("region_code", region)
      .eq("seniority_band", "mid")
      .in("onet_soc_code", allSocs)
      .limit(200)
    for (const row of salaryRows ?? []) {
      if (typeof row.salary_mid === "number") {
        salaryMidBySoc.set(String(row.onet_soc_code), row.salary_mid)
      }
    }

    const { data: demandRows } = await supabaseAdmin
      .schema("careeros")
      .from("market_demand_trajectories")
      .select("onet_soc_code,demand_delta_pct")
      .eq("region_code", region)
      .eq("window_code", "M360")
      .in("onet_soc_code", allSocs)
      .limit(200)
    for (const row of demandRows ?? []) {
      if (typeof row.demand_delta_pct === "number") {
        demandDeltaBySoc.set(String(row.onet_soc_code), row.demand_delta_pct)
      }
    }
  }

  const sourceMidSalary = salaryMidBySoc.get(soc) ?? null
  const sourceDemandDelta = demandDeltaBySoc.get(soc) ?? null

  // snapshot rows (per-user audit trail)
  const snapshotId = randomUUID()
  await supabaseAdmin
    .schema("careeros")
    .from("user_adjacent_role_snapshots")
    .update({ is_current: false })
    .eq("user_id", userId)
    .eq("is_current", true)

  await supabaseAdmin.schema("careeros").from("user_adjacent_role_snapshots").insert({
    id: snapshotId,
    user_id: userId,
    source_role_soc_code: soc,
    snapshot_window_code: "M360",
    generated_at: new Date().toISOString(),
    is_current: true,
    model_version: "heuristic-v1",
    prompt_version: "none",
    schema_version: "1",
    input_data_version: ADJACENT_ROLES_SOURCE_DATASET_VERSION,
    source_attribution: { source_dataset_version: ADJACENT_ROLES_SOURCE_DATASET_VERSION },
  })

  const itemRows = marketRows.map((r) => {
    const p = buildAdjacentPersonalisation({
      targetSocCode: String(r.target_soc_code),
      userSkills,
      salaryMidBySoc,
      demandDeltaBySoc,
      sourceMidSalary,
      sourceDemandDelta,
    })
    return {
      target_salary_mid: p.targetSalary,
      target_demand_delta: p.targetDemand,
      source_salary_mid: sourceMidSalary,
      source_demand_delta: sourceDemandDelta,
      bridge_skills: p.bridgeSkills,
      user_id: userId,
      snapshot_id: snapshotId,
      source_soc_code: soc,
      target_soc_code: String(r.target_soc_code),
      market_adjacent_role_id: r.id,
      rank_position: Number(r.rank_position),
      personalised_fit_score: Number(r.similarity_score),
      explain_payload: {
        ...(r.explain_payload && typeof r.explain_payload === "object" ? r.explain_payload : {}),
        bridge_skills: p.bridgeSkills,
        salary_mid_delta_usd:
          p.targetSalary != null && sourceMidSalary != null
            ? Math.round(p.targetSalary - sourceMidSalary)
            : null,
        demand_delta_pct_points:
          p.targetDemand != null && sourceDemandDelta != null
            ? Number((p.targetDemand - sourceDemandDelta).toFixed(1))
            : null,
      },
      model_version: "heuristic-v1",
      prompt_version: "none",
      schema_version: "1",
      input_data_version: ADJACENT_ROLES_SOURCE_DATASET_VERSION,
      source_attribution: {},
    }
  })

  await supabaseAdmin.schema("careeros").from("user_adjacent_role_items").insert(itemRows)

  return {
    status: "ready" as const,
    source_soc_code: soc,
    items: marketRows.map((r) => {
      const p = buildAdjacentPersonalisation({
        targetSocCode: String(r.target_soc_code),
        userSkills,
        salaryMidBySoc,
        demandDeltaBySoc,
        sourceMidSalary,
        sourceDemandDelta,
      })
      return {
        bridge_skills: p.bridgeSkills.map(prettySkillLabel),
        bridge_skill_keys: p.bridgeSkills,
        salary_mid_delta_usd: p.salaryDeltaUsd,
        salary_mid_delta_pct: p.salaryDeltaPct,
        demand_delta_pct_points: p.demandDeltaPctPoints,
        source_salary_mid: sourceMidSalary,
        target_salary_mid: p.targetSalary,
        source_demand_delta_pct: sourceDemandDelta,
        target_demand_delta_pct: p.targetDemand,
        bridge_skill_count: p.bridgeSkills.length,
        target_soc_code: String(r.target_soc_code),
        target_title: occBySoc.get(String(r.target_soc_code)) ?? String(r.target_soc_code),
        rank_position: Number(r.rank_position),
        similarity_score: Number(r.similarity_score),
      }
    }),
  }
}

export type AdjacentRolesForUserResult = Awaited<ReturnType<typeof getAdjacentRolesForUser>>
