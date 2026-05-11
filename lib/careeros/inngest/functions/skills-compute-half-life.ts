import { createHash, randomUUID } from "crypto"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"
import {
  computeHalfLife,
  HALF_LIFE_METHODOLOGY_VERSION,
  type HalfLifeInput,
} from "@/lib/careeros/skills/half-life-compute"

const SCHEMA_VERSION = "1"
const MODEL_VERSION = "formula-v1"
const PROMPT_VERSION = "n/a"

function inputDataVersion(inputs: HalfLifeInput[]): string {
  const canonical = JSON.stringify(
    inputs
      .map((i) => ({
        k: i.canonical_skill_key,
        v: i.velocity_score,
        e: i.exposure_score,
        c: i.exposure_category,
      }))
      .sort((a, b) => a.k.localeCompare(b.k)),
  )
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16)
}

type VelocityEntry = {
  velocity_score: number
  mention_count: number
  prior_window_mention_count: number | null
}

type ExposureEntry = {
  exposure_score: number
  exposure_category: string
}

type UserSkill = { id: string; canonical_skill_key: string; skill_name: string }

type ComputedRow = {
  user_skill_id: string
  canonical_skill_key: string
  input: HalfLifeInput
  result: ReturnType<typeof computeHalfLife>
  has_velocity: boolean
}

type UpsertedRow = { id: string; user_skill_id: string; status: string }

export const skillsComputeHalfLife = careerosInngest.createFunction(
  {
    id: "careeros-skills-compute-half-life-for-user",
    name: "CareerOS skills.compute-half-life-for-user",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: "careeros/skills.compute-half-life-for-user" }],
  },
  async ({ step, event }) => {
    const userId: string = event.data.user_id
    const today = new Date().toISOString().slice(0, 10)

    // Step 1: Load user context
    const userContext = await step.run("load-user-context", async () => {
      const [{ data: skills, error: skillsErr }, { data: profile, error: profileErr }] =
        await Promise.all([
          supabaseAdmin
            .schema("careeros")
            .from("user_skills")
            .select("id,canonical_skill_key,skill_name")
            .eq("user_id", userId)
            .eq("is_active", true),
          supabaseAdmin
            .schema("careeros")
            .from("user_profiles")
            .select("location_region_code")
            .eq("user_id", userId)
            .maybeSingle(),
        ])
      if (skillsErr) throw skillsErr
      if (profileErr) throw profileErr
      return {
        skills: (skills ?? []) as UserSkill[],
        region_code: (profile?.location_region_code as string | null) ?? "GLOBAL",
      }
    })

    if (userContext.skills.length === 0) {
      return { user_id: userId, skills_computed: 0, by_status: {} }
    }

    const skillKeys = userContext.skills.map((s) => s.canonical_skill_key)
    const regionCode = userContext.region_code

    // Step 2: Fetch velocity data per skill — returns plain record for JSON serialisation
    const velocityRecord = await step.run("fetch-velocity-data", async () => {
      const { data, error } = await supabaseAdmin
        .schema("careeros")
        .from("market_skill_velocity")
        .select(
          "canonical_skill_key,velocity_score,mention_count,prior_window_mention_count,region_code",
        )
        .in("canonical_skill_key", skillKeys)
        .eq("window_code", "M360")
        .in("region_code", [regionCode, "GLOBAL"])

      if (error) throw error

      // Build plain record: prefer user region over GLOBAL
      const result: Record<string, VelocityEntry> = {}
      for (const row of data ?? []) {
        const key = String(row.canonical_skill_key)
        const isUserRegion = String(row.region_code) === regionCode
        if (!result[key] || isUserRegion) {
          result[key] = {
            velocity_score: Number(row.velocity_score ?? 0),
            mention_count: Number(row.mention_count ?? 0),
            prior_window_mention_count:
              row.prior_window_mention_count != null
                ? Number(row.prior_window_mention_count)
                : null,
          }
        }
      }
      return result
    })

    // Step 3: Fetch exposure data — returns plain record
    const exposureRecord = await step.run("fetch-exposure-data", async () => {
      const { data, error } = await supabaseAdmin
        .schema("careeros")
        .from("skill_ai_exposure_scores")
        .select("canonical_skill_key,exposure_score,exposure_category")
        .in("canonical_skill_key", skillKeys)

      if (error) throw error

      const result: Record<string, ExposureEntry> = {}
      for (const row of data ?? []) {
        result[String(row.canonical_skill_key)] = {
          exposure_score: Number(row.exposure_score),
          exposure_category: String(row.exposure_category),
        }
      }
      return result
    })

    // Step 4: Compute all half-lives
    const computed = await step.run("compute-all-half-lives", async () => {
      const rows: ComputedRow[] = []
      for (const skill of userContext.skills) {
        const vel = velocityRecord[skill.canonical_skill_key] as VelocityEntry | undefined
        const exp = exposureRecord[skill.canonical_skill_key] as ExposureEntry | undefined
        const has_velocity = vel !== undefined

        const input: HalfLifeInput = {
          canonical_skill_key: skill.canonical_skill_key,
          velocity_score: vel?.velocity_score ?? 0,
          mention_count: vel?.mention_count ?? 0,
          prior_window_mention_count: vel?.prior_window_mention_count ?? null,
          exposure_score: exp?.exposure_score ?? 0.5,
          exposure_category:
            (exp?.exposure_category as HalfLifeInput["exposure_category"]) ?? "medium",
        }

        const result = computeHalfLife(input)

        if (!has_velocity) {
          result.factors_payload.overrides_applied.push("no_velocity_data_available")
          result.confidence = "low"
          result.status = "stable"
        }

        rows.push({
          user_skill_id: skill.id,
          canonical_skill_key: skill.canonical_skill_key,
          input,
          result,
          has_velocity,
        })
      }
      return rows
    })

    // Step 5: Persist half-life rows
    const idv = inputDataVersion(computed.map((c) => c.input))

    const upserted = await step.run("persist-half-life-rows", async () => {
      const rows = computed.map((c) => ({
        id: randomUUID(),
        user_id: userId,
        user_skill_id: c.user_skill_id,
        calculated_for_date: today,
        half_life_days:
          c.result.half_life_months !== null
            ? Math.round(c.result.half_life_months * 30.44)
            : null,
        half_life_months: c.result.half_life_months,
        half_life_range_low_months: c.result.half_life_range?.low ?? null,
        half_life_range_high_months: c.result.half_life_range?.high ?? null,
        confidence_score:
          c.result.confidence === "high" ? 0.9 : c.result.confidence === "medium" ? 0.6 : 0.3,
        confidence: c.result.confidence,
        status: c.result.status,
        velocity_score_used: c.input.velocity_score,
        exposure_score_used: c.input.exposure_score,
        exposure_category_used: c.input.exposure_category,
        factors_payload: c.result.factors_payload,
        methodology_version: HALF_LIFE_METHODOLOGY_VERSION,
        model_version: MODEL_VERSION,
        prompt_version: PROMPT_VERSION,
        schema_version: SCHEMA_VERSION,
        input_data_version: idv,
        source_attribution: {
          formula_version: HALF_LIFE_METHODOLOGY_VERSION,
          has_velocity: c.has_velocity,
        },
      }))

      const { data, error } = await supabaseAdmin
        .schema("careeros")
        .from("user_skill_half_life")
        .upsert(rows, {
          onConflict: "user_skill_id,calculated_for_date,schema_version",
          ignoreDuplicates: false,
        })
        .select("id,user_skill_id,status")

      if (error) throw error
      return (data ?? []) as UpsertedRow[]
    })

    // Step 6: Denormalise status back to user_skills
    await step.run("denormalise-user-skills", async () => {
      // Build lookup from upserted rows
      const idMap: Record<string, { id: string; status: string }> = {}
      for (const row of upserted) {
        idMap[row.user_skill_id] = { id: row.id, status: row.status }
      }

      for (const skill of userContext.skills) {
        const hl = idMap[skill.id]
        if (!hl) continue
        const { error } = await supabaseAdmin
          .schema("careeros")
          .from("user_skills")
          .update({
            current_status: hl.status,
            current_half_life_id: hl.id,
          })
          .eq("id", skill.id)
        if (error) throw error
      }
    })

    // Step 7: Audit generation run
    await step.run("audit-generation-run", async () => {
      const byStatus: Record<string, number> = {}
      for (const c of computed) {
        byStatus[c.result.status] = (byStatus[c.result.status] ?? 0) + 1
      }

      const { error } = await supabaseAdmin
        .schema("careeros")
        .from("generation_runs")
        .insert({
          id: randomUUID(),
          user_id: userId,
          artefact_table: "careeros.user_skill_half_life",
          artefact_id: null,
          workflow_name: "careeros/skills.compute-half-life-for-user",
          provider: "other",
          model_name: "formula",
          model_version: "v1",
          prompt_version: PROMPT_VERSION,
          schema_version: SCHEMA_VERSION,
          input_data_version: idv,
          source_attribution: { skills_computed: computed.length },
          input_hash: idv,
          output_hash: `${computed.length}:${today}`,
          latency_ms: null,
          token_usage: null,
          status: "completed",
        })
      if (error) throw error
    })

    const byStatus: Record<string, number> = {}
    for (const c of computed) {
      byStatus[c.result.status] = (byStatus[c.result.status] ?? 0) + 1
    }

    return {
      user_id: userId,
      skills_computed: computed.length,
      by_status: byStatus,
    }
  },
)
