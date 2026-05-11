/**
 * Unit tests for computeHalfLife — no framework required.
 * Run with: npx tsx test/careeros/skills/half-life-compute.test.ts
 */
import { computeHalfLife, type HalfLifeInput } from "@/lib/careeros/skills/half-life-compute"

type Assertion = {
  label: string
  input: HalfLifeInput
  expect: {
    status?: string
    confidence?: string
    half_life_months_null?: boolean
    half_life_months_positive?: boolean
    override_includes?: string
    has_range?: boolean
  }
}

const cases: Assertion[] = [
  {
    label: "1. Stable growing skill (Python-like): rising, high confidence",
    input: {
      canonical_skill_key: "python",
      velocity_score: 15,
      mention_count: 5000,
      prior_window_mention_count: 4800,
      exposure_score: 0.20,
      exposure_category: "low",
    },
    expect: { status: "rising", confidence: "high" },
  },
  {
    label: "2. Augmenting skill with explosive growth: rising",
    input: {
      canonical_skill_key: "prompt-engineering",
      velocity_score: 340,
      mention_count: 3000,
      prior_window_mention_count: 2900,
      exposure_score: 0.05,
      exposure_category: "augmenting",
    },
    expect: { status: "rising" },
  },
  {
    label: "3. Augmenting skill with declining demand: at-risk, override applied",
    input: {
      canonical_skill_key: "langchain",
      velocity_score: -10,
      mention_count: 500,
      prior_window_mention_count: 480,
      exposure_score: 0.05,
      exposure_category: "augmenting",
    },
    expect: { status: "at-risk", override_includes: "augmenting_skill_declining_demand" },
  },
  {
    label: "4. High AI exposure but growing (data entry automation): at-risk override",
    input: {
      canonical_skill_key: "data-entry",
      velocity_score: 5,
      mention_count: 2000,
      prior_window_mention_count: 1950,
      exposure_score: 0.80,
      exposure_category: "high",
    },
    expect: { status: "at-risk", override_includes: "high_ai_exposure_despite_growth" },
  },
  {
    label: "5. Declining skill (jQuery, v=-25, e=0.30): at-risk (D=0.28>0.15), half_life positive",
    input: {
      canonical_skill_key: "jquery",
      velocity_score: -25,
      mention_count: 1500,
      prior_window_mention_count: 1450,
      exposure_score: 0.30,
      exposure_category: "low",
    },
    // D = 25/100 + 0.30*0.10 = 0.28 → at-risk (D > 0.15)
    expect: { status: "at-risk", half_life_months_positive: true },
  },
  {
    label: "5b. Declining status: v=-8, e=0.20 → D=0.08, declining",
    input: {
      canonical_skill_key: "ruby",
      velocity_score: -8,
      mention_count: 1200,
      prior_window_mention_count: 1150,
      exposure_score: 0.20,
      exposure_category: "low",
    },
    // D = 8/100 + 0.20*0.10 = 0.08 + 0.02 = 0.10 → declining (0.05 < D <= 0.15)
    expect: { status: "declining", half_life_months_positive: true },
  },
  {
    label: "6. At-risk: high decline + high exposure",
    input: {
      canonical_skill_key: "vba",
      velocity_score: -40,
      mention_count: 800,
      prior_window_mention_count: 790,
      exposure_score: 0.75,
      exposure_category: "high",
    },
    expect: { status: "at-risk" },
  },
  {
    label: "7. Stable: small positive velocity, low exposure",
    input: {
      canonical_skill_key: "go",
      velocity_score: 2,
      mention_count: 300,
      prior_window_mention_count: 290,
      exposure_score: 0.20,
      exposure_category: "low",
    },
    expect: { status: "stable", half_life_months_null: true },
  },
  {
    label: "8. Low confidence: small sample, range present when at-risk",
    input: {
      canonical_skill_key: "flash",
      velocity_score: -50,
      mention_count: 50,
      prior_window_mention_count: 48,
      exposure_score: 0.90,
      exposure_category: "high",
    },
    expect: { confidence: "low", has_range: true },
  },
  {
    label: "9. Medium confidence: 300 mentions, moderate volatility",
    input: {
      canonical_skill_key: "ruby",
      velocity_score: -20,
      mention_count: 300,
      prior_window_mention_count: 200,
      exposure_score: 0.40,
      exposure_category: "medium",
    },
    expect: { confidence: "medium" },
  },
  {
    label: "10. Edge case: v=0 exactly → stable",
    input: {
      canonical_skill_key: "perl",
      velocity_score: 0,
      mention_count: 2000,
      prior_window_mention_count: 2000,
      exposure_score: 0.20,
      exposure_category: "low",
    },
    expect: { status: "stable" },
  },
  {
    label: "11. Edge case: v=-100 → at-risk with very short half-life",
    input: {
      canonical_skill_key: "silverlight",
      velocity_score: -100,
      mention_count: 500,
      prior_window_mention_count: 490,
      exposure_score: 0.90,
      exposure_category: "high",
    },
    expect: { status: "at-risk", half_life_months_positive: true },
  },
]

let passed = 0
let failed = 0
const failures: string[] = []

for (const tc of cases) {
  try {
    const result = computeHalfLife(tc.input)
    const ex = tc.expect

    if (ex.status !== undefined && result.status !== ex.status) {
      throw new Error(`status: expected "${ex.status}", got "${result.status}"`)
    }
    if (ex.confidence !== undefined && result.confidence !== ex.confidence) {
      throw new Error(`confidence: expected "${ex.confidence}", got "${result.confidence}"`)
    }
    if (ex.half_life_months_null && result.half_life_months !== null) {
      throw new Error(`half_life_months: expected null, got ${result.half_life_months}`)
    }
    if (ex.half_life_months_positive) {
      if (result.half_life_months === null || result.half_life_months <= 0) {
        throw new Error(`half_life_months: expected positive, got ${result.half_life_months}`)
      }
    }
    if (ex.override_includes !== undefined) {
      if (!result.factors_payload.overrides_applied.includes(ex.override_includes)) {
        throw new Error(
          `overrides_applied: expected to include "${ex.override_includes}", got [${result.factors_payload.overrides_applied.join(", ")}]`,
        )
      }
    }
    if (ex.has_range && result.half_life_range === null) {
      throw new Error(`half_life_range: expected non-null range`)
    }

    process.stdout.write(`  PASS  ${tc.label}\n`)
    passed++
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`  FAIL  ${tc.label}\n         ${msg}\n`)
    failures.push(tc.label)
    failed++
  }
}

process.stdout.write(`\n${passed} passed, ${failed} failed.\n`)
if (failed > 0) {
  process.exit(1)
}
