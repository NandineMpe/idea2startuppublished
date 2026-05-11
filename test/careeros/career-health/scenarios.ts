import { buildPillarScores, compositeFromPillars } from "@/lib/careeros/career-health/composite-score"
import type { CareerHealthStructuredInputs } from "@/lib/careeros/career-health/types"

/** Fixed clock so period_label and scores stay stable in CI. */
const FIXED_NOW = new Date("2026-05-11T12:00:00.000Z")

function periodFromDate(d: Date): { report_year: number; report_quarter: number; period_label: string } {
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const q = m <= 3 ? 1 : m <= 6 ? 2 : m <= 9 ? 3 : 4
  return { report_year: y, report_quarter: q, period_label: `Q${q} ${y}` }
}

function buildStructured(args: {
  profile: CareerHealthStructuredInputs["profile"]
  skills: CareerHealthStructuredInputs["skills"]
  demandDeltaPctM360: number | null
  salaryVsMarketMidDeltaPct: number | null
  layoffSeverity0to1: number | null
  layoff: Record<string, unknown>
  demand: Record<string, unknown>
  salary: Record<string, unknown>
}): CareerHealthStructuredInputs {
  const { report_year, report_quarter, period_label } = periodFromDate(FIXED_NOW)
  const pillars = buildPillarScores({
    skillRows: args.skills.map((s) => ({
      half_life_status: s.half_life_status,
      exposure_score: s.exposure_score,
    })),
    demandDeltaPctM360: args.demandDeltaPctM360,
    salaryVsMarketMidDeltaPct: args.salaryVsMarketMidDeltaPct,
    layoffSeverity0to1: args.layoffSeverity0to1,
  })
  const composite = compositeFromPillars(pillars)
  return {
    generated_at_iso: FIXED_NOW.toISOString(),
    period_label,
    report_year,
    report_quarter,
    profile: args.profile,
    skills: args.skills,
    demand: args.demand,
    salary: args.salary,
    layoff: args.layoff,
    pillar_scores: pillars,
    composite_score_0_100: composite,
  }
}

export type CareerHealthVerifyScenario = {
  /** Matches `test/careeros/fixtures/profiles/*` folder names. */
  personaId: string
  label: string
  structured: CareerHealthStructuredInputs
}

export const CAREER_HEALTH_VERIFY_SCENARIOS: CareerHealthVerifyScenario[] = [
  {
    personaId: "senior-engineer",
    label: "Senior engineer (strong tech stack, mild demand tailwind)",
    structured: buildStructured({
      profile: {
        current_role_title: "Principal Software Engineer",
        target_role_title: "Distinguished Engineer",
        onet_soc_code: "15-1252.00",
        region_code: "US-CA",
        years_experience: 12,
        current_salary_usd: 245_000,
      },
      skills: [
        {
          skill_name: "Python",
          canonical_skill_key: "python",
          half_life_status: "stable",
          exposure_score: 0.22,
          exposure_category: "low",
        },
        {
          skill_name: "AWS Lambda",
          canonical_skill_key: "aws-lambda",
          half_life_status: "rising",
          exposure_score: 0.35,
          exposure_category: "medium",
        },
        {
          skill_name: "Kubernetes",
          canonical_skill_key: "kubernetes",
          half_life_status: "declining",
          exposure_score: 0.42,
          exposure_category: "medium",
        },
      ],
      demandDeltaPctM360: 6,
      salaryVsMarketMidDeltaPct: 4,
      layoffSeverity0to1: null,
      layoff: { status: "no_recent_company_signals" },
      demand: { status: "ready", onet_soc_code: "15-1252.00", region_code: "US-CA" },
      salary: { status: "ready", inferred_seniority_band: "senior" },
    }),
  },
  {
    personaId: "career-changer",
    label: "Career changer (mixed skill risk, flat demand)",
    structured: buildStructured({
      profile: {
        current_role_title: "Product Analyst",
        target_role_title: "Software Engineer",
        onet_soc_code: "15-1252.00",
        region_code: "US-NY",
        years_experience: 5,
        current_salary_usd: 118_000,
      },
      skills: [
        {
          skill_name: "SQL",
          canonical_skill_key: "sql",
          half_life_status: "stable",
          exposure_score: 0.38,
          exposure_category: "medium",
        },
        {
          skill_name: "JavaScript",
          canonical_skill_key: "javascript",
          half_life_status: "at-risk",
          exposure_score: 0.55,
          exposure_category: "high",
        },
        {
          skill_name: "jQuery",
          canonical_skill_key: "jquery",
          half_life_status: "declining",
          exposure_score: 0.65,
          exposure_category: "high",
        },
      ],
      demandDeltaPctM360: 0,
      salaryVsMarketMidDeltaPct: -6,
      layoffSeverity0to1: 0.35,
      layoff: { status: "has_company_signals", note: "synthetic QA severity" },
      demand: { status: "ready" },
      salary: { status: "ready" },
    }),
  },
  {
    personaId: "freelancer-designer",
    label: "Freelance designer (creative stack, softer posting signal)",
    structured: buildStructured({
      profile: {
        current_role_title: "Freelance Product Designer",
        target_role_title: "Design Lead",
        onet_soc_code: "27-1024.00",
        region_code: "EU-IE",
        years_experience: 7,
        current_salary_usd: null,
      },
      skills: [
        {
          skill_name: "Figma",
          canonical_skill_key: "figma",
          half_life_status: "rising",
          exposure_score: 0.28,
          exposure_category: "medium",
        },
        {
          skill_name: "User Research",
          canonical_skill_key: "user-research",
          half_life_status: "stable",
          exposure_score: 0.25,
          exposure_category: "low",
        },
      ],
      demandDeltaPctM360: -4,
      salaryVsMarketMidDeltaPct: null,
      layoffSeverity0to1: null,
      layoff: { status: "phase_4_employer_not_resolved" },
      demand: { status: "ready" },
      salary: { status: "profile_incomplete" },
    }),
  },
  {
    personaId: "non-tech-marketing",
    label: "Non-tech marketing (lower tech exposure average)",
    structured: buildStructured({
      profile: {
        current_role_title: "Growth Marketing Manager",
        target_role_title: "Head of Growth",
        onet_soc_code: "11-2021.00",
        region_code: "US-TX",
        years_experience: 8,
        current_salary_usd: 132_000,
      },
      skills: [
        {
          skill_name: "SEO",
          canonical_skill_key: "seo",
          half_life_status: "stable",
          exposure_score: 0.48,
          exposure_category: "medium",
        },
        {
          skill_name: "Marketing Analytics",
          canonical_skill_key: "marketing-analytics",
          half_life_status: "rising",
          exposure_score: 0.32,
          exposure_category: "medium",
        },
      ],
      demandDeltaPctM360: 10,
      salaryVsMarketMidDeltaPct: 2,
      layoffSeverity0to1: null,
      layoff: { status: "not_linked" },
      demand: { status: "ready" },
      salary: { status: "ready" },
    }),
  },
  {
    personaId: "recent-grad-pm",
    label: "Recent grad PM (junior band, fewer skills)",
    structured: buildStructured({
      profile: {
        current_role_title: "Associate Product Manager",
        target_role_title: "Product Manager",
        onet_soc_code: "11-9199.00",
        region_code: "US-WA",
        years_experience: 1.5,
        current_salary_usd: 92_000,
      },
      skills: [
        {
          skill_name: "Roadmapping",
          canonical_skill_key: "roadmap",
          half_life_status: "stable",
          exposure_score: 0.4,
          exposure_category: "medium",
        },
        {
          skill_name: "Experimentation",
          canonical_skill_key: "experimentation",
          half_life_status: "rising",
          exposure_score: 0.2,
          exposure_category: "low",
        },
      ],
      demandDeltaPctM360: 14,
      salaryVsMarketMidDeltaPct: 8,
      layoffSeverity0to1: null,
      layoff: { status: "no_recent_company_signals" },
      demand: { status: "ready" },
      salary: { status: "ready" },
    }),
  },
]
