/**
 * Runs the real selection code against the real corpus, per industry.
 *
 * The model pass is the expensive, unverifiable half. This is the half that
 * decides whether the dossier stands on anything, and it is fully deterministic,
 * so it can and should be checked directly. A dossier whose 'ahead' section
 * rests on two patents is a guess with citations, and the only way to know that
 * before spending the tokens is to count first.
 *
 * Run with: npx tsx scripts/creator-check-industry-selection.ts
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "node:fs"
import { INDUSTRY_SEEDS, horizonLabel } from "../lib/creator/industry/definitions"
import { countByBand, selectIndustrySignals } from "../lib/creator/industry/select"

const env = readFileSync(".env.vercel.production", "utf8")
const get = (k: string) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : ""
}

const USER_ID = "e909b041-e338-4ad5-a515-a1bcc6d2e9b3"
const supabase = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"))

async function main() {
  let weak = 0

  for (const seed of INDUSTRY_SEEDS) {
    const signals = await selectIndustrySignals(supabase, USER_ID, seed.match_terms, seed.weak_terms ?? [])
    const counts = countByBand(signals)
    const lanes = [...new Set(signals.map((s) => s.lane))]

    const buildable = signals.length >= 8
    const forecastable = counts.ahead >= 5
    if (!buildable || !forecastable) weak++

    console.log(`\n${"=".repeat(72)}`)
    console.log(`${seed.label}  [${seed.slug}]`)
    console.log(
      `  ${signals.length} signals · ${counts.ahead} leading, ${counts.present} present, ${counts.behind} lagging · ${lanes.length} registers`,
    )
    console.log(`  buildable (>=8): ${buildable ? "yes" : "NO"}   forecastable (>=5 leading): ${forecastable ? "yes" : "THIN"}`)

    const leading = signals.filter((s) => s.band === "ahead").slice(0, 5)
    if (leading.length) {
      console.log("  leading evidence the forecast would rest on:")
      for (const s of leading) {
        console.log(
          `    [${s.lane}, ${horizonLabel(s.lane)}] ${(s.published_at ?? "").slice(0, 10)} score=${s.score}`,
        )
        console.log(`      ${s.title.slice(0, 100)}`)
      }
    } else {
      console.log("  NO leading evidence: this dossier could describe the past but not forecast.")
    }
  }

  console.log(`\n${"=".repeat(72)}`)
  console.log(`${INDUSTRY_SEEDS.length - weak}/${INDUSTRY_SEEDS.length} industries have enough to build AND forecast`)
}

main()
