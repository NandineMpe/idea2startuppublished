import { qwenGenerateObject, QWEN_MODEL_NAME } from "@/lib/careeros/ai/qwen"
import {
  POSTING_SKILL_EXTRACT_SYSTEM_PROMPT,
  POSTING_SKILL_PROMPT_VERSION,
  buildPostingSkillExtractUserPrompt,
} from "@/lib/careeros/prompts/posting-skill-extract.v1"
import {
  PostingSkillExtractSchema,
  POSTING_SKILL_EXTRACT_SCHEMA_VERSION,
} from "@/lib/careeros/schemas/posting-skill-extract.v1"
import { DEMAND_WINDOW_DAYS, type DemandWindowCode } from "@/lib/careeros/market/demand-windows"
import { fetchPostingsForVelocity, type MarketPosting } from "@/lib/careeros/market/posting-ingester"
import {
  loadSkillSynonymMap,
  normaliseSkillKey,
  resolveCanonicalSkillKey,
} from "@/lib/careeros/market/skill-synonyms"
import { supabaseAdmin } from "@/lib/supabase"

export const SKILL_VELOCITY_DATASET_VERSION = "skill-velocity-v1"

const MIN_MENTION_THRESHOLD = 50
const MIN_ABSOLUTE_INCREASE = 100
const MIN_PCT_INCREASE = 25
const OUTLIER_EMPLOYER_CAP = 0.15

type VelocityRow = {
  canonical_skill_key: string
  region_code: string
  window_code: DemandWindowCode
  window_start: string
  window_end: string
  velocity_score: number
  direction: "growing" | "declining" | "flat" | "new"
  mention_count: number
  prior_window_mention_count: number | null
  source_dataset_version: string
  source_attribution: Record<string, unknown>
}

function computeDirection(current: number, prior: number | null): VelocityRow["direction"] {
  if (prior == null || prior <= 0) return "new"
  if (current === prior) return "flat"
  return current > prior ? "growing" : "declining"
}

function computeVelocityPct(current: number, prior: number | null): number {
  if (prior == null || prior <= 0) return 0
  return Math.round((((current - prior) / prior) * 100) * 10000) / 10000
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function extractPostingSkills(
  postings: MarketPosting[],
  canonicalHints: string[],
  synonyms: Map<string, string>,
): Promise<{ byPosting: Map<string, Set<string>>; usageTokens: number }> {
  const byPosting = new Map<string, Set<string>>()
  let usageTokens = 0

  for (const p of postings) {
    const userPrompt = buildPostingSkillExtractUserPrompt({
      postingText: p.description_text,
      title: p.title,
      canonicalHints,
    })
    const { object, usage } = await qwenGenerateObject({
      schema: PostingSkillExtractSchema,
      systemPrompt: POSTING_SKILL_EXTRACT_SYSTEM_PROMPT,
      userPrompt,
    })
    usageTokens += usage.totalTokens
    const keys = new Set<string>()
    for (const s of object.skills) {
      const canonical = resolveCanonicalSkillKey(s.canonical_skill_key, synonyms)
      const k = normaliseSkillKey(canonical)
      if (k) keys.add(k)
    }
    byPosting.set(p.posting_id, keys)
  }

  return { byPosting, usageTokens }
}

function aggregateMentions(
  postings: MarketPosting[],
  skillsByPosting: Map<string, Set<string>>,
): Map<string, { mentions: number; employers: Map<string, number> }> {
  const out = new Map<string, { mentions: number; employers: Map<string, number> }>()
  for (const p of postings) {
    const skills = skillsByPosting.get(p.posting_id) ?? new Set<string>()
    for (const skill of skills) {
      const row = out.get(skill) ?? { mentions: 0, employers: new Map<string, number>() }
      row.mentions += 1
      const emp = (p.employer_name ?? "unknown").trim().toLowerCase()
      row.employers.set(emp, (row.employers.get(emp) ?? 0) + 1)
      out.set(skill, row)
    }
  }
  return out
}

function passesNoiseSuppression(
  current: number,
  prior: number | null,
  employerMaxShare: number,
): boolean {
  if (current < MIN_MENTION_THRESHOLD) return false
  if (employerMaxShare > OUTLIER_EMPLOYER_CAP) return false
  if (prior == null || prior <= 0) return true
  const abs = current - prior
  const pct = (abs / prior) * 100
  if (abs >= MIN_ABSOLUTE_INCREASE && pct >= MIN_PCT_INCREASE) return true
  if (abs <= -MIN_ABSOLUTE_INCREASE) return true
  return Math.abs(pct) < MIN_PCT_INCREASE // allow flat-ish stable skills
}

async function canonicalHintsFromCache(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .schema("careeros")
    .from("onet_skills_cache")
    .select("name,onet_skill_id")
    .limit(500)
  return (data ?? [])
    .map((r) => normaliseSkillKey(String(r.name ?? r.onet_skill_id ?? "")))
    .filter((x) => x.length > 1)
}

export async function computeAndStoreSkillVelocity(params: {
  region_code: string
  window_code: DemandWindowCode
  roleQueryHint: string
}): Promise<{
  rows_written: number
  postings_processed: number
  extraction_tokens: number
  unique_skills: number
  source_stats: Record<string, unknown>
}> {
  const days = DEMAND_WINDOW_DAYS[params.window_code]
  const lookback = days * 2
  const [synonyms, hints] = await Promise.all([loadSkillSynonymMap(), canonicalHintsFromCache()])
  const currentFetch = await fetchPostingsForVelocity({
    region_code: params.region_code,
    jobTitle: params.roleQueryHint,
    lookbackDays: days,
    maxPerSource: 120,
  })
  const priorFetch = await fetchPostingsForVelocity({
    region_code: params.region_code,
    jobTitle: params.roleQueryHint,
    lookbackDays: lookback,
    maxPerSource: 160,
  })

  // split prior window by date heuristic
  const now = Date.now()
  const cutoff = now - days * 24 * 60 * 60 * 1000
  const priorOnly = priorFetch.postings.filter((p) => {
    const ts = p.posted_at ? Date.parse(p.posted_at) : 0
    return ts > 0 && ts < cutoff
  })

  const batches = chunk([...currentFetch.postings, ...priorOnly], 8)
  const globalSkillsByPosting = new Map<string, Set<string>>()
  let tokens = 0
  for (const b of batches) {
    const { byPosting, usageTokens } = await extractPostingSkills(b, hints, synonyms)
    tokens += usageTokens
    for (const [k, v] of byPosting) globalSkillsByPosting.set(k, v)
  }

  const currentAgg = aggregateMentions(currentFetch.postings, globalSkillsByPosting)
  const priorAgg = aggregateMentions(priorOnly, globalSkillsByPosting)
  const nowDate = new Date()
  const ws = new Date(nowDate)
  ws.setUTCDate(ws.getUTCDate() - days)

  const rows: VelocityRow[] = []
  for (const [skill, curr] of currentAgg) {
    const prior = priorAgg.get(skill)?.mentions ?? null
    const employerMax = Math.max(
      0,
      ...[...curr.employers.values()].map((n) => n / Math.max(1, curr.mentions)),
    )
    if (!passesNoiseSuppression(curr.mentions, prior, employerMax)) continue
    rows.push({
      canonical_skill_key: skill,
      region_code: params.region_code,
      window_code: params.window_code,
      window_start: ws.toISOString().slice(0, 10),
      window_end: nowDate.toISOString().slice(0, 10),
      velocity_score: computeVelocityPct(curr.mentions, prior),
      direction: computeDirection(curr.mentions, prior),
      mention_count: curr.mentions,
      prior_window_mention_count: prior,
      source_dataset_version: SKILL_VELOCITY_DATASET_VERSION,
      source_attribution: {
        source_mix: { current: currentFetch.sourceStats, prior: priorFetch.sourceStats },
        thresholds: {
          min_mentions: MIN_MENTION_THRESHOLD,
          min_absolute_increase: MIN_ABSOLUTE_INCREASE,
          min_pct_increase: MIN_PCT_INCREASE,
          outlier_employer_cap: OUTLIER_EMPLOYER_CAP,
        },
        extraction: {
          model: QWEN_MODEL_NAME,
          prompt_version: POSTING_SKILL_PROMPT_VERSION,
          schema_version: POSTING_SKILL_EXTRACT_SCHEMA_VERSION,
        },
      },
    })
  }

  if (rows.length) {
    const { error } = await supabaseAdmin
      .schema("careeros")
      .from("market_skill_velocity")
      .upsert(rows, {
        onConflict:
          "canonical_skill_key,region_code,window_code,window_end,source_dataset_version",
      })
    if (error) throw error
  }

  return {
    rows_written: rows.length,
    postings_processed: currentFetch.postings.length + priorOnly.length,
    extraction_tokens: tokens,
    unique_skills: rows.length,
    source_stats: { current: currentFetch.sourceStats, prior: priorFetch.sourceStats },
  }
}

export async function getTopRisingSkillsGlobal(window: DemandWindowCode, limit = 20) {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_skill_velocity")
    .select(
      "canonical_skill_key,velocity_score,mention_count,prior_window_mention_count,direction,region_code",
    )
    .eq("window_code", window)
    .eq("region_code", "GLOBAL")
    .eq("source_dataset_version", SKILL_VELOCITY_DATASET_VERSION)
    .order("velocity_score", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getTopDecliningSkillsGlobal(window: DemandWindowCode, limit = 20) {
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_skill_velocity")
    .select(
      "canonical_skill_key,velocity_score,mention_count,prior_window_mention_count,direction,region_code",
    )
    .eq("window_code", window)
    .eq("region_code", "GLOBAL")
    .eq("source_dataset_version", SKILL_VELOCITY_DATASET_VERSION)
    .order("velocity_score", { ascending: true })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getPersonalSkillVelocityForUser(
  userId: string,
  window: DemandWindowCode = "M360",
) {
  const [{ data: profile }, { data: userSkills }] = await Promise.all([
    supabaseAdmin
      .schema("careeros")
      .from("user_profiles")
      .select("onet_soc_code,location_region_code")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .schema("careeros")
      .from("user_skills")
      .select("canonical_skill_key")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(200),
  ])

  const region = (profile?.location_region_code as string | null) ?? "GLOBAL"
  const scopeSkills = new Set<string>(
    (userSkills ?? []).map((s) => normaliseSkillKey(String(s.canonical_skill_key))),
  )

  // augment with O*NET skill hints for user's mapped SOC
  const soc = (profile?.onet_soc_code as string | null)?.trim()
  if (soc) {
    const { data: occ } = await supabaseAdmin
      .schema("careeros")
      .from("user_onet_skill_graphs")
      .select("raw_graph")
      .eq("user_id", userId)
      .eq("onet_soc_code", soc)
      .limit(1)
      .maybeSingle()
    const raw = occ?.raw_graph as Record<string, unknown> | undefined
    const walk = (v: unknown) => {
      if (Array.isArray(v)) return v.forEach(walk)
      if (!v || typeof v !== "object") return
      const o = v as Record<string, unknown>
      if (typeof o.name === "string") scopeSkills.add(normaliseSkillKey(o.name))
      Object.values(o).forEach(walk)
    }
    walk(raw)
  }

  if (!scopeSkills.size) {
    return { rising: [], declining: [], region_code: region, status: "no-eligible-skills" as const }
  }

  const keys = [...scopeSkills].filter(Boolean).slice(0, 300)
  const { data, error } = await supabaseAdmin
    .schema("careeros")
    .from("market_skill_velocity")
    .select("canonical_skill_key,velocity_score,mention_count,prior_window_mention_count,direction")
    .eq("window_code", window)
    .in("canonical_skill_key", keys)
    .in("region_code", [region, "GLOBAL"])
    .eq("source_dataset_version", SKILL_VELOCITY_DATASET_VERSION)
    .order("velocity_score", { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = data ?? []
  return {
    status: "ready" as const,
    region_code: region,
    rising: rows.filter((r) => Number(r.velocity_score) >= 0).slice(0, 10),
    declining: rows.filter((r) => Number(r.velocity_score) < 0).slice(0, 10),
  }
}
