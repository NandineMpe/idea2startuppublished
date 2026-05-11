import { readFile } from "fs/promises"
import path from "path"
import { createClient } from "@supabase/supabase-js"

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

type ExposureEntry = {
  canonical_skill_key: string
  exposure_score: number
  exposure_category: "low" | "medium" | "high" | "augmenting"
  source: "eloundou_2023" | "mckinsey_2024" | "qwen_inference_v1" | "manual"
  rationale?: string
}

const VALID_CATEGORIES = new Set(["low", "medium", "high", "augmenting"])
const VALID_SOURCES = new Set(["eloundou_2023", "mckinsey_2024", "qwen_inference_v1", "manual"])

function validate(entry: unknown, idx: number): ExposureEntry {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`Entry ${idx} is not an object`)
  }
  const e = entry as Record<string, unknown>
  if (typeof e.canonical_skill_key !== "string" || !e.canonical_skill_key.trim()) {
    throw new Error(`Entry ${idx}: canonical_skill_key must be a non-empty string`)
  }
  if (typeof e.exposure_score !== "number" || e.exposure_score < 0 || e.exposure_score > 1) {
    throw new Error(`Entry ${idx} (${e.canonical_skill_key}): exposure_score must be 0.0-1.0, got ${e.exposure_score}`)
  }
  if (!VALID_CATEGORIES.has(e.exposure_category as string)) {
    throw new Error(`Entry ${idx} (${e.canonical_skill_key}): invalid exposure_category "${e.exposure_category}"`)
  }
  if (!VALID_SOURCES.has(e.source as string)) {
    throw new Error(`Entry ${idx} (${e.canonical_skill_key}): invalid source "${e.source}"`)
  }
  return {
    canonical_skill_key: e.canonical_skill_key as string,
    exposure_score: e.exposure_score as number,
    exposure_category: e.exposure_category as ExposureEntry["exposure_category"],
    source: e.source as ExposureEntry["source"],
    rationale: typeof e.rationale === "string" ? e.rationale : undefined,
  }
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  const sb = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  })

  const dataPath = path.join(process.cwd(), "data", "careeros", "exposure-scores-v1.json")
  const raw = await readFile(dataPath, "utf-8")
  const parsed: unknown = JSON.parse(raw)

  if (!Array.isArray(parsed)) {
    throw new Error("Expected an array in exposure-scores-v1.json")
  }

  const entries = parsed.map((entry, idx) => validate(entry, idx))

  let inserted = 0
  let updated = 0
  const errors: string[] = []

  // Process in batches of 50
  const BATCH_SIZE = 50
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    const rows = batch.map((e) => ({
      canonical_skill_key: e.canonical_skill_key,
      exposure_score: e.exposure_score,
      exposure_category: e.exposure_category,
      source: e.source,
      rationale: e.rationale ?? null,
      methodology_version: "v1",
      last_reviewed_at: new Date().toISOString(),
    }))

    const { data, error } = await sb
      .schema("careeros")
      .from("skill_ai_exposure_scores")
      .upsert(rows, { onConflict: "canonical_skill_key", ignoreDuplicates: false })
      .select("id,canonical_skill_key")

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`)
      continue
    }

    const count = data?.length ?? 0
    // Heuristic: first run all are inserts; subsequent runs all are updates
    if (i === 0 && count > 0) {
      inserted += count
    } else {
      updated += count
    }
  }

  if (errors.length) {
    process.stderr.write(`Errors:\n${errors.join("\n")}\n`)
    process.exit(1)
  }

  const total = entries.length
  process.stdout.write(
    `Seed complete. Total entries: ${total}. Upserted: ${inserted + updated} (inserted: ${inserted}, updated: ${updated})\n`,
  )
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
