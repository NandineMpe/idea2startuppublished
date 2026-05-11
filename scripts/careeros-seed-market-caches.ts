import { createClient } from "@supabase/supabase-js"
import { DEMAND_TOP_REGIONS } from "../lib/careeros/market/demand-regions"
import { DEMAND_TOP_50_SOCS } from "../lib/careeros/market/demand-soc-list"
import { DEMAND_SOURCE_DATASET_VERSION } from "../lib/careeros/market/demand-version"
import { DEMAND_WINDOW_CODES, DEMAND_WINDOW_DAYS } from "../lib/careeros/market/demand-windows"
import { SALARY_SENIORITY_BANDS, SALARY_SOURCE_DATASET_VERSION } from "../lib/careeros/market/salary-version"
import { SKILL_VELOCITY_DATASET_VERSION } from "../lib/careeros/market/skill-velocity"

const TREND_OVERRIDES: Record<string, { driftM360: number; driftM720: number }> = {
  "ai-llm": { driftM360: 120, driftM720: 180 },
  "ai-agents": { driftM360: 110, driftM720: 170 },
  "artificial-intelligence": { driftM360: 95, driftM720: 150 },
  "machine-learning": { driftM360: 80, driftM720: 120 },
  "prompt-engineering": { driftM360: 90, driftM720: 130 },
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

  const sb = createClient(url, key)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const onetRelease = process.env.ONET_DATA_RELEASE?.trim() || "28.3"

  const occupations = DEMAND_TOP_50_SOCS.map((soc, i) => ({
    onet_soc_code: soc,
    onet_release: onetRelease,
    title: `Occupation ${soc}`,
    description: null,
    attributes: { seeded: true, rank: i + 1 },
  }))
  {
    const { error } = await sb
      .schema("careeros")
      .from("onet_occupations_cache")
      .upsert(occupations, { onConflict: "onet_soc_code,onet_release" })
    if (error) throw error
  }

  const demandRows: Array<Record<string, unknown>> = []
  for (const soc of DEMAND_TOP_50_SOCS) {
    for (const region of DEMAND_TOP_REGIONS) {
      for (const windowCode of DEMAND_WINDOW_CODES) {
        const days = DEMAND_WINDOW_DAYS[windowCode]
        const windowStart = new Date(now)
        windowStart.setUTCDate(windowStart.getUTCDate() - days)
        const base =
          ((Math.abs([...soc].reduce((a, c) => a + c.charCodeAt(0), 0)) +
            region.region_code.length * 17) %
            700) +
          150
        const delta = ((base % 41) - 20) / 10
        demandRows.push({
          onet_soc_code: soc,
          region_code: region.region_code,
          window_code: windowCode,
          window_start: windowStart.toISOString().slice(0, 10),
          window_end: today,
          demand_index: Number(base.toFixed(3)),
          demand_delta_pct: Number(delta.toFixed(3)),
          source_dataset_version: DEMAND_SOURCE_DATASET_VERSION,
          source_attribution: { seeded: true, method: "deterministic-seed-v1" },
        })
      }
    }
  }
  {
    const { error } = await sb
      .schema("careeros")
      .from("market_demand_trajectories")
      .upsert(demandRows, {
        onConflict: "onet_soc_code,region_code,window_code,window_end,source_dataset_version",
      })
    if (error) throw error
  }

  const salaryRows: Array<Record<string, unknown>> = []
  for (const soc of DEMAND_TOP_50_SOCS) {
    for (const region of DEMAND_TOP_REGIONS) {
      const seed =
        (Math.abs([...soc].reduce((a, c) => a + c.charCodeAt(0), 0)) +
          region.region_code.length * 113) %
        90000
      const midBase = 45000 + seed
      for (const band of SALARY_SENIORITY_BANDS) {
        const mult = band === "junior" ? 0.78 : band === "mid" ? 1 : 1.32
        const mid = Math.round(midBase * mult)
        salaryRows.push({
          onet_soc_code: soc,
          seniority_band: band,
          region_code: region.region_code,
          currency_code: "EUR",
          salary_min: Math.round(mid * 0.82),
          salary_mid: mid,
          salary_max: Math.round(mid * 1.2),
          sample_size: 80 + (seed % 30),
          source_dataset_version: SALARY_SOURCE_DATASET_VERSION,
          source_attribution: { seeded: true, method: "deterministic-seed-v1" },
        })
      }
    }
  }
  {
    const { error } = await sb
      .schema("careeros")
      .from("market_salary_bands")
      .upsert(salaryRows, {
        onConflict: "onet_soc_code,seniority_band,region_code,source_dataset_version",
      })
    if (error) throw error
  }

  const synonyms = [
    ["js", "javascript"],
    ["ts", "typescript"],
    ["reactjs", "react"],
    ["nodejs", "node-js"],
    ["postgres", "postgresql"],
    ["aws-cloud", "aws"],
    ["ml", "machine-learning"],
    ["ai", "artificial-intelligence"],
    ["k8s", "kubernetes"],
    ["ci-cd", "ci-cd"],
  ].map(([syn, canonical]) => ({
    synonym_key: syn,
    canonical_skill_key: canonical,
    confidence: 0.95,
    source: "seed",
  }))
  {
    const { error } = await sb
      .schema("careeros")
      .from("skill_synonyms")
      .upsert(synonyms, { onConflict: "synonym_key" })
    if (error) throw error
  }

  const skills = [
    "ai-llm",
    "ai-agents",
    "prompt-engineering",
    "python",
    "javascript",
    "typescript",
    "react",
    "node-js",
    "sql",
    "postgresql",
    "aws",
    "kubernetes",
    "docker",
    "machine-learning",
    "artificial-intelligence",
    "data-analysis",
    "product-management",
    "figma",
    "terraform",
    "go",
    "java",
    "c-sharp",
    "swift",
  ]
  const regions = ["GLOBAL", ...DEMAND_TOP_REGIONS.map((r) => r.region_code)]
  const windows = ["M360", "M720"] as const
  const velocityRows: Array<Record<string, unknown>> = []
  for (const region of regions) {
    for (const window of windows) {
      const days = window === "M360" ? 360 : 720
      const windowStart = new Date(now)
      windowStart.setUTCDate(windowStart.getUTCDate() - days)
      for (const skill of skills) {
        const seed =
          (Math.abs([...skill].reduce((a, c) => a + c.charCodeAt(0), 0)) +
            region.length * 19 +
            window.length * 23) %
          220
        const prior = 80 + seed
        const baselineDrift = (seed % 70) - 35
        const override = TREND_OVERRIDES[skill]
        const drift =
          override != null
            ? window === "M360"
              ? override.driftM360
              : override.driftM720
            : baselineDrift
        const curr = Math.max(20, prior + drift)
        const score = prior > 0 ? Number((((curr - prior) / prior) * 100).toFixed(4)) : 0
        const direction =
          prior <= 0 ? "new" : curr > prior ? "growing" : curr < prior ? "declining" : "flat"
        velocityRows.push({
          canonical_skill_key: skill,
          region_code: region,
          window_code: window,
          window_start: windowStart.toISOString().slice(0, 10),
          window_end: today,
          velocity_score: score,
          direction,
          mention_count: curr,
          prior_window_mention_count: prior,
          source_dataset_version: SKILL_VELOCITY_DATASET_VERSION,
          source_attribution: { seeded: true, method: "deterministic-seed-v1" },
        })
      }
    }
  }
  {
    const { error } = await sb
      .schema("careeros")
      .from("market_skill_velocity")
      .upsert(velocityRows, {
        onConflict: "canonical_skill_key,region_code,window_code,window_end,source_dataset_version",
      })
    if (error) throw error
  }

  console.log(
    JSON.stringify({
      onet_occupations: occupations.length,
      demand_rows: demandRows.length,
      salary_rows: salaryRows.length,
      skill_velocity_rows: velocityRows.length,
      synonyms: synonyms.length,
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
