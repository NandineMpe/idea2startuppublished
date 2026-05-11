/**
 * Adjacent-role trajectory automated gate (5 fixture personas, no DB).
 * Run: npx tsx test/careeros/market/verify-trajectory-gate.ts
 */
import { TRAJECTORY_MODEL_VERSION } from "@/lib/careeros/market/adjacent-trajectory-model"
import { buildAdjacentTrajectoryRowsFromInputs } from "@/lib/careeros/market/adjacent-trajectory"
import type { AdjacentTrajectoryRow } from "@/lib/careeros/market/adjacent-trajectory"
import { TRAJECTORY_VERIFY_SCENARIOS } from "./trajectory-scenarios"

function assertSensibleTrajectoryRows(personaId: string, rows: AdjacentTrajectoryRow[]): string[] {
  const errors: string[] = []
  if (rows.length < 1) {
    errors.push("expected at least one trajectory row")
    return errors
  }

  for (const r of rows) {
    if (r.trajectory_model_version !== TRAJECTORY_MODEL_VERSION) {
      errors.push(`unexpected model version for ${personaId}`)
    }
    if (!r.methodology_note.includes("BLS")) {
      errors.push(`methodology_note missing BLS disclaimer for ${personaId}`)
    }
    if (r.similarity_score <= 0 || r.similarity_score > 1 || !Number.isFinite(r.similarity_score)) {
      errors.push(`similarity_score out of range for ${personaId}`)
    }
    if (r.learning_hours_per_week < 1 || r.learning_hours_per_week > 40) {
      errors.push(`learning_hours_per_week out of range for ${personaId}`)
    }
    if (r.bridge_weeks < 4) {
      errors.push(`bridge_weeks below model floor for ${personaId}`)
    }
    if (!Number.isFinite(r.baseline_annual_usd) || r.baseline_annual_usd <= 0) {
      errors.push(`baseline invalid for ${personaId}`)
    }
    if (!Number.isFinite(r.stay_path_year3_usd) || r.stay_path_year3_usd <= 0) {
      errors.push(`stay_path_year3_usd invalid for ${personaId}`)
    }
    if (!Number.isFinite(r.switch_path_year3_usd) || r.switch_path_year3_usd <= 0) {
      errors.push(`switch_path_year3_usd invalid for ${personaId}`)
    }
    if (r.stay_path_year3_usd < r.baseline_annual_usd * 0.88) {
      errors.push(`stay_path_year3_usd implausibly below baseline for ${personaId}`)
    }
    const gMax = 12
    const gMin = -1.5
    if (
      r.source_implied_annual_pay_growth_pct < gMin ||
      r.source_implied_annual_pay_growth_pct > gMax ||
      r.target_implied_annual_pay_growth_pct < gMin ||
      r.target_implied_annual_pay_growth_pct > gMax
    ) {
      errors.push(`implied growth pct out of sanity band for ${personaId}`)
    }
  }

  return errors
}

let passed = 0
let failed = 0

for (const scenario of TRAJECTORY_VERIFY_SCENARIOS) {
  const rows = buildAdjacentTrajectoryRowsFromInputs({
    salary: scenario.salary,
    adjacent: scenario.adjacent,
    learningHoursPerWeek: scenario.learningHoursPerWeek,
    yearsExperience: scenario.yearsExperience,
    sourceBands: scenario.sourceBands,
    bandsByTarget: scenario.bandsByTarget,
  })
  const errors = assertSensibleTrajectoryRows(scenario.personaId, rows)
  if (errors.length === 0) {
    process.stdout.write(`  PASS  [${scenario.personaId}] ${scenario.label}\n`)
    passed++
  } else {
    failed++
    process.stderr.write(`  FAIL  [${scenario.personaId}] ${scenario.label}\n`)
    for (const e of errors) {
      process.stderr.write(`         - ${e}\n`)
    }
  }
}

process.stdout.write(`\nCareerOS trajectory gate: ${passed} passed, ${failed} failed.\n`)
if (failed > 0) {
  process.exit(1)
}
