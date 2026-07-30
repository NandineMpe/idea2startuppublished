/**
 * Offline eval: occupation vector + Claude pipeline (no DB writes).
 * Usage: npx tsx scripts/careeros/eval-onet-mapping.ts
 * Requires: ANTHROPIC_API_KEY, OPENAI_API_KEY (embeddings), ONET credentials.
 */
import { readFileSync } from "fs"
import { join } from "path"
import {
  matchOccupationWithVectorAndClaude,
  type OccupationMatchContext,
} from "../../lib/careeros/onet/occupation-match"

type Fixture = {
  id: string
  current_role_title: string
  target_role_title?: string
  years_experience?: number
  top_skills?: string[]
  expected_soc_prefix?: string
}

async function main() {
  const path = join(process.cwd(), "data/careeros/onet-mapping-fixtures.json")
  const fixtures = JSON.parse(readFileSync(path, "utf8")) as Fixture[]

  let passed = 0
  const rows: string[] = []

  for (const f of fixtures) {
    const ctx: OccupationMatchContext = {
      current_role_title: f.current_role_title,
      target_role_title: f.target_role_title ?? null,
      years_experience: f.years_experience ?? null,
      top_skill_names: f.top_skills ?? [],
      location_label: null,
    }

    try {
      const result = await matchOccupationWithVectorAndClaude(ctx)
      const soc = result?.soc_code ?? ""
      const prefixOk =
        !f.expected_soc_prefix || soc.startsWith(f.expected_soc_prefix)
      const ok = Boolean(soc) && prefixOk && (result?.claude_confidence ?? 0) >= 0.5
      if (ok) passed += 1
      rows.push(
        `| ${f.id} | ${soc || "—"} | ${result?.claude_confidence?.toFixed(2) ?? "—"} | ${prefixOk ? "yes" : "no"} | ${ok ? "PASS" : "FAIL"} |`,
      )
    } catch (e) {
      rows.push(
        `| ${f.id} | error | — | — | FAIL (${e instanceof Error ? e.message : String(e)}) |`,
      )
    }
  }

  const pct = fixtures.length ? Math.round((passed / fixtures.length) * 100) : 0
  console.log("# O*NET occupation mapping eval (vector + Claude)\n")
  console.log("| Fixture | SOC | Claude conf | Prefix OK | Result |")
  console.log("|---------|-----|-------------|-----------|--------|")
  for (const r of rows) console.log(r)
  console.log(`\nPass rate: ${passed}/${fixtures.length} (${pct}%)`)
  console.log("Target for production gate: 90%+ on 20 diverse fixtures (expand data/careeros/onet-mapping-fixtures.json).")
  process.exit(pct >= 90 ? 0 : 1)
}

void main()
