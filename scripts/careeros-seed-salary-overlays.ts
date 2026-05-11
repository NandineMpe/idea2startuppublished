import { createClient } from "@supabase/supabase-js"
import { SALARY_SOURCE_DATASET_VERSION } from "../lib/careeros/market/salary-version"

const SPECIALISATIONS = [
  { key: "machine-learning", deltaPct: 0.18, label: "Machine Learning" },
  { key: "ai-llm", deltaPct: 0.22, label: "AI / LLM" },
  { key: "cloud-architecture", deltaPct: 0.14, label: "Cloud Architecture" },
  { key: "cybersecurity", deltaPct: 0.16, label: "Cybersecurity" },
  { key: "data-engineering", deltaPct: 0.15, label: "Data Engineering" },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  const sb = createClient(url, key)

  const bands: Array<{ id: string; salary_min: number; salary_mid: number | null; salary_max: number }> = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb
      .schema("careeros")
      .from("market_salary_bands")
      .select("id,salary_min,salary_mid,salary_max")
      .eq("source_dataset_version", SALARY_SOURCE_DATASET_VERSION)
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = (data ?? []) as Array<{
      id: string
      salary_min: number
      salary_mid: number | null
      salary_max: number
    }>
    bands.push(...page)
    if (page.length < pageSize) break
  }

  const rows =
    bands.flatMap((b) =>
      SPECIALISATIONS.map((s) => ({
        market_salary_band_id: b.id as string,
        overlay_skill_key: s.key,
        delta_pct: s.deltaPct,
        salary_min_override: Math.round(Number(b.salary_min) * (1 + s.deltaPct)),
        salary_mid_override:
          typeof b.salary_mid === "number" ? Math.round(Number(b.salary_mid) * (1 + s.deltaPct)) : null,
        salary_max_override: Math.round(Number(b.salary_max) * (1 + s.deltaPct)),
        source_dataset_version: SALARY_SOURCE_DATASET_VERSION,
        source_attribution: {
          seeded_overlay: true,
          label: s.label,
          methodology: "static_high_value_specialisation_uplift_v1",
        },
      })),
    ) ?? []

  if (rows.length) {
    const { error: upErr } = await sb
      .schema("careeros")
      .from("market_salary_band_overlays")
      .upsert(rows, {
        onConflict: "market_salary_band_id,overlay_skill_key,source_dataset_version",
      })
    if (upErr) throw upErr
  }

  console.log(JSON.stringify({ salary_bands: bands.length, overlays_written: rows.length }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
