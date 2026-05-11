import { randomUUID } from "crypto"
import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"
import { qwenGenerateObject, QWEN_MODEL_NAME, QWEN_MODEL_VERSION } from "@/lib/careeros/ai/qwen"
import {
  EXPOSURE_INFERENCE_SYSTEM_PROMPT,
  EXPOSURE_INFERENCE_PROMPT_VERSION,
  buildExposureInferenceUserPrompt,
} from "@/lib/careeros/prompts/exposure-inference.v1"

const ExposureInferenceOutputSchema = z.object({
  canonical_skill_key: z.string(),
  exposure_score: z.number().min(0).max(1),
  exposure_category: z.enum(["augmenting", "low", "medium", "high"]),
  source: z.literal("qwen_inference_v1"),
  rationale: z.string(),
})

const BATCH_SIZE = 10
const RATE_LIMIT_SLEEP_MS = 2000

export const exposureScoreRefresh = careerosInngest.createFunction(
  {
    id: "careeros-exposure-score-refresh",
    name: "CareerOS skills.refresh-exposure-scores",
    retries: 1,
    triggers: [
      { cron: "0 0 1 */3 *" },
      { event: "careeros/skills.refresh-exposure-scores" },
    ],
  },
  async ({ step }) => {
    // Step 1: Find unscored skills
    const unscoredKeys = await step.run("find-unscored-skills", async () => {
      // Top 500 skills by global mention count from market_skill_velocity
      const { data: velocityRows, error: velErr } = await supabaseAdmin
        .schema("careeros")
        .from("market_skill_velocity")
        .select("canonical_skill_key,mention_count")
        .eq("region_code", "GLOBAL")
        .order("mention_count", { ascending: false })
        .limit(500)

      if (velErr) throw velErr

      const topKeys = [
        ...new Set((velocityRows ?? []).map((r) => String(r.canonical_skill_key))),
      ]

      if (topKeys.length === 0) return []

      // Find which of these already have exposure scores
      const { data: scored, error: scoreErr } = await supabaseAdmin
        .schema("careeros")
        .from("skill_ai_exposure_scores")
        .select("canonical_skill_key")
        .in("canonical_skill_key", topKeys)

      if (scoreErr) throw scoreErr

      const scoredSet = new Set((scored ?? []).map((r) => String(r.canonical_skill_key)))
      return topKeys.filter((k) => !scoredSet.has(k))
    })

    if (unscoredKeys.length === 0) {
      return { unscored_found: 0, inferred: 0, persisted: 0 }
    }

    let totalInferred = 0
    let totalPersisted = 0
    const errors: string[] = []

    // Process in batches of BATCH_SIZE
    const batches: string[][] = []
    for (let i = 0; i < unscoredKeys.length; i += BATCH_SIZE) {
      batches.push(unscoredKeys.slice(i, i + BATCH_SIZE))
    }

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]

      const batchResults = await step.run(`infer-exposure-batch-${batchIdx}`, async () => {
        const results: Array<z.infer<typeof ExposureInferenceOutputSchema>> = []

        for (const skillKey of batch) {
          try {
            const { object } = await qwenGenerateObject({
              schema: ExposureInferenceOutputSchema,
              systemPrompt: EXPOSURE_INFERENCE_SYSTEM_PROMPT,
              userPrompt: buildExposureInferenceUserPrompt(skillKey),
            })
            results.push({ ...object, canonical_skill_key: skillKey })
          } catch (err) {
            // Log key without revealing any user data
            errors.push(`skill "${skillKey}": ${err instanceof Error ? err.message : String(err)}`)
          }
        }

        return results
      })

      totalInferred += batchResults.length

      if (batchResults.length > 0) {
        const persisted = await step.run(`persist-inferred-scores-batch-${batchIdx}`, async () => {
          const rows = batchResults.map((r) => ({
            id: randomUUID(),
            canonical_skill_key: r.canonical_skill_key,
            exposure_score: r.exposure_score,
            exposure_category: r.exposure_category,
            source: "qwen_inference_v1" as const,
            rationale: r.rationale,
            methodology_version: "v1",
            last_reviewed_at: new Date().toISOString(),
          }))

          const { error } = await supabaseAdmin
            .schema("careeros")
            .from("skill_ai_exposure_scores")
            .upsert(rows, { onConflict: "canonical_skill_key", ignoreDuplicates: false })

          if (error) throw error
          return rows.length
        })
        totalPersisted += persisted
      }

      // Rate-limit between batches (skip sleep after last batch)
      if (batchIdx < batches.length - 1) {
        await step.sleep(`rate-limit-batch-${batchIdx}`, RATE_LIMIT_SLEEP_MS)
      }
    }

    return {
      unscored_found: unscoredKeys.length,
      inferred: totalInferred,
      persisted: totalPersisted,
      errors_count: errors.length,
      prompt_version: EXPOSURE_INFERENCE_PROMPT_VERSION,
      model_name: QWEN_MODEL_NAME,
      model_version: QWEN_MODEL_VERSION,
    }
  },
)
