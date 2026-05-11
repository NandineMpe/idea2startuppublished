/**
 * Career Health Report automated quality gate (5 fixture-aligned personas).
 * Run: npx tsx test/careeros/career-health/verify-quality-gate.ts
 */
import { validateCareerHealthReportBundle } from "@/lib/careeros/career-health/validate-report-payload"
import { mockNarrativeForVerify } from "./mock-narrative"
import { CAREER_HEALTH_VERIFY_SCENARIOS } from "./scenarios"

let passed = 0
let failed = 0

for (const scenario of CAREER_HEALTH_VERIFY_SCENARIOS) {
  const narrative = mockNarrativeForVerify(scenario.structured, scenario.personaId)
  const { ok, errors } = validateCareerHealthReportBundle(scenario.structured, narrative, {
    strictHeadlineScore: true,
  })
  if (ok) {
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

process.stdout.write(`\nCareer Health quality gate: ${passed} passed, ${failed} failed.\n`)
if (failed > 0) {
  process.exit(1)
}
