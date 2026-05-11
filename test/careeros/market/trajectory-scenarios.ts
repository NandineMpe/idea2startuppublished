import type { AdjacentRolesForUserResult } from "@/lib/careeros/market/adjacent-roles"
import type { TrajectoryBandRow } from "@/lib/careeros/market/adjacent-trajectory"
import type { UserSalaryBandsResult } from "@/lib/careeros/market/salary-bands"
import type { SalarySeniorityBand } from "@/lib/careeros/market/salary-version"

type SalaryReady = Extract<UserSalaryBandsResult, { status: "ready" }>
type AdjacentReady = Extract<AdjacentRolesForUserResult, { status: "ready" }>

export type TrajectoryVerifyScenario = {
  personaId: string
  label: string
  yearsExperience: number | null
  learningHoursPerWeek: number
  salary: SalaryReady
  adjacent: AdjacentReady
  sourceBands: Map<SalarySeniorityBand, TrajectoryBandRow>
  bandsByTarget: Map<string, Map<SalarySeniorityBand, TrajectoryBandRow>>
}

function fixtureBandsFromAnchor(anchorMidUsd: number): Map<SalarySeniorityBand, TrajectoryBandRow> {
  const row = (band: SalarySeniorityBand, mult: number): TrajectoryBandRow => {
    const mid = Math.round(anchorMidUsd * mult)
    return {
      seniority_band: band,
      salary_min: Math.round(mid * 0.9),
      salary_mid: mid,
      salary_max: Math.round(mid * 1.12),
    }
  }
  const m = new Map<SalarySeniorityBand, TrajectoryBandRow>()
  m.set("junior", row("junior", 0.82))
  m.set("mid", row("mid", 1))
  m.set("senior", row("senior", 1.18))
  return m
}

function targetBandMaps(
  entries: Array<{ soc: string; anchorMidUsd: number }>,
): Map<string, Map<SalarySeniorityBand, TrajectoryBandRow>> {
  const out = new Map<string, Map<SalarySeniorityBand, TrajectoryBandRow>>()
  for (const e of entries) {
    out.set(e.soc, fixtureBandsFromAnchor(e.anchorMidUsd))
  }
  return out
}

function inferredSeniorityBand(years: number | null): SalarySeniorityBand {
  if (years == null || Number.isNaN(years)) return "mid"
  if (years < 3) return "junior"
  if (years < 8) return "mid"
  return "senior"
}

function makeSalaryReady(args: {
  onet_soc_code: string
  region_code: string
  occupation_title: string | null
  years_experience: number | null
  current_salary_usd: number | null
  anchorMidUsd: number
}): SalaryReady {
  const inferred = inferredSeniorityBand(args.years_experience)
  const bandsArr = (["junior", "mid", "senior"] as const).map((bandKey) => {
    const slice = fixtureBandsFromAnchor(args.anchorMidUsd).get(bandKey)!
    return {
      seniority_band: slice.seniority_band,
      currency_code: "USD",
      salary_min: slice.salary_min,
      salary_mid: slice.salary_mid,
      salary_max: slice.salary_max,
      sample_size: 30,
      attribution_summary: "Fixture QA (deterministic)",
      attribution_updated_at: null,
      is_seeded_data: true,
      source_attribution: { fixture: true },
    }
  })
  const currentBandRow = bandsArr.find((b) => b.seniority_band === inferred) ?? bandsArr[1]!
  return {
    status: "ready",
    onet_soc_code: args.onet_soc_code,
    region_code: args.region_code,
    occupation_title: args.occupation_title,
    years_experience: args.years_experience,
    current_salary_usd: args.current_salary_usd,
    inferred_seniority_band: inferred,
    current_band: {
      seniority_band: currentBandRow.seniority_band,
      salary_min: currentBandRow.salary_min,
      salary_mid: currentBandRow.salary_mid,
      salary_max: currentBandRow.salary_max,
      currency_code: "USD",
    },
    current_vs_market_mid_delta_pct: 0,
    delta_uses_actual_salary: args.current_salary_usd != null,
    bands: bandsArr,
    overlays: [],
  }
}

function adjItem(p: {
  target_soc_code: string
  target_title: string
  rank_position: number
  similarity_score: number
  bridge_skill_keys: string[]
  source_salary_mid: number | null
  target_salary_mid: number | null
  source_demand_delta_pct: number | null
  target_demand_delta_pct: number | null
}): AdjacentReady["items"][number] {
  const bridge_skill_keys = p.bridge_skill_keys
  const bridge_skills = bridge_skill_keys.map((k) => k.replace(/-/g, " "))
  const salary_mid_delta_usd =
    p.target_salary_mid != null && p.source_salary_mid != null
      ? Math.round(p.target_salary_mid - p.source_salary_mid)
      : null
  const salary_mid_delta_pct =
    p.target_salary_mid != null && p.source_salary_mid != null && p.source_salary_mid > 0
      ? Number((((p.target_salary_mid - p.source_salary_mid) / p.source_salary_mid) * 100).toFixed(1))
      : null
  const demand_delta_pct_points =
    p.target_demand_delta_pct != null && p.source_demand_delta_pct != null
      ? Number((p.target_demand_delta_pct - p.source_demand_delta_pct).toFixed(1))
      : null
  return {
    bridge_skills,
    bridge_skill_keys,
    salary_mid_delta_usd,
    salary_mid_delta_pct,
    demand_delta_pct_points,
    source_salary_mid: p.source_salary_mid,
    target_salary_mid: p.target_salary_mid,
    source_demand_delta_pct: p.source_demand_delta_pct,
    target_demand_delta_pct: p.target_demand_delta_pct,
    bridge_skill_count: bridge_skill_keys.length,
    target_soc_code: p.target_soc_code,
    target_title: p.target_title,
    rank_position: p.rank_position,
    similarity_score: p.similarity_score,
  }
}

function makeAdjacentReady(p: {
  source_soc_code: string
  items: AdjacentReady["items"]
}): AdjacentReady {
  return {
    status: "ready",
    source_soc_code: p.source_soc_code,
    items: p.items,
  }
}

/** Five personas aligned with `CAREER_HEALTH_VERIFY_SCENARIOS` profiles (synthetic numbers). */
export const TRAJECTORY_VERIFY_SCENARIOS: TrajectoryVerifyScenario[] = [
  (function () {
    const sourceSoc = "15-1252.00"
    const anchor = 210_000
    const salary = makeSalaryReady({
      onet_soc_code: sourceSoc,
      region_code: "US-CA",
      occupation_title: "Principal Software Engineer",
      years_experience: 12,
      current_salary_usd: 245_000,
      anchorMidUsd: anchor,
    })
    const seniorMid = fixtureBandsFromAnchor(anchor).get("senior")!.salary_mid!
    const t1 = "15-2051.00"
    const t2 = "15-1211.00"
    const mid1 = fixtureBandsFromAnchor(265_000).get("senior")!.salary_mid!
    const mid2 = fixtureBandsFromAnchor(238_000).get("senior")!.salary_mid!
    return {
      personaId: "senior-engineer",
      label: "Senior engineer (fixture trajectory)",
      yearsExperience: 12,
      learningHoursPerWeek: 8,
      salary,
      adjacent: makeAdjacentReady({
        source_soc_code: sourceSoc,
        items: [
          adjItem({
            target_soc_code: t1,
            target_title: "Software Developer (fixture)",
            rank_position: 1,
            similarity_score: 0.72,
            bridge_skill_keys: ["machine-learning", "ai-llm"],
            source_salary_mid: seniorMid,
            target_salary_mid: mid1,
            source_demand_delta_pct: 6,
            target_demand_delta_pct: 10,
          }),
          adjItem({
            target_soc_code: t2,
            target_title: "Computer Systems Analyst (fixture)",
            rank_position: 2,
            similarity_score: 0.61,
            bridge_skill_keys: ["sql", "kubernetes"],
            source_salary_mid: seniorMid,
            target_salary_mid: mid2,
            source_demand_delta_pct: 6,
            target_demand_delta_pct: 2,
          }),
        ],
      }),
      sourceBands: fixtureBandsFromAnchor(anchor),
      bandsByTarget: targetBandMaps([
        { soc: t1, anchorMidUsd: 265_000 },
        { soc: t2, anchorMidUsd: 238_000 },
      ]),
    }
  })(),
  (function () {
    const sourceSoc = "15-1252.00"
    const anchor = 135_000
    const salary = makeSalaryReady({
      onet_soc_code: sourceSoc,
      region_code: "US-NY",
      occupation_title: "Product Analyst",
      years_experience: 5,
      current_salary_usd: 118_000,
      anchorMidUsd: anchor,
    })
    const midBandMid = fixtureBandsFromAnchor(anchor).get("mid")!.salary_mid!
    const t1 = "15-1254.00"
    const mid1 = fixtureBandsFromAnchor(155_000).get("mid")!.salary_mid!
    return {
      personaId: "career-changer",
      label: "Career changer (fixture trajectory)",
      yearsExperience: 5,
      learningHoursPerWeek: 6,
      salary,
      adjacent: makeAdjacentReady({
        source_soc_code: sourceSoc,
        items: [
          adjItem({
            target_soc_code: t1,
            target_title: "Web Developer (fixture)",
            rank_position: 1,
            similarity_score: 0.58,
            bridge_skill_keys: ["typescript", "kubernetes", "machine-learning"],
            source_salary_mid: midBandMid,
            target_salary_mid: mid1,
            source_demand_delta_pct: 0,
            target_demand_delta_pct: 4,
          }),
        ],
      }),
      sourceBands: fixtureBandsFromAnchor(anchor),
      bandsByTarget: targetBandMaps([{ soc: t1, anchorMidUsd: 155_000 }]),
    }
  })(),
  (function () {
    const sourceSoc = "27-1024.00"
    const anchor = 82_000
    const salary = makeSalaryReady({
      onet_soc_code: sourceSoc,
      region_code: "EU-IE",
      occupation_title: "Freelance Product Designer",
      years_experience: 7,
      current_salary_usd: null,
      anchorMidUsd: anchor,
    })
    const midBandMid = fixtureBandsFromAnchor(anchor).get("mid")!.salary_mid!
    const t1 = "27-1014.00"
    const mid1 = fixtureBandsFromAnchor(96_000).get("mid")!.salary_mid!
    return {
      personaId: "freelancer-designer",
      label: "Freelance designer (fixture trajectory, salary from band mid)",
      yearsExperience: 7,
      learningHoursPerWeek: 5,
      salary,
      adjacent: makeAdjacentReady({
        source_soc_code: sourceSoc,
        items: [
          adjItem({
            target_soc_code: t1,
            target_title: "Multimedia Artist (fixture)",
            rank_position: 1,
            similarity_score: 0.55,
            bridge_skill_keys: ["sql"],
            source_salary_mid: midBandMid,
            target_salary_mid: mid1,
            source_demand_delta_pct: -4,
            target_demand_delta_pct: 1,
          }),
        ],
      }),
      sourceBands: fixtureBandsFromAnchor(anchor),
      bandsByTarget: targetBandMaps([{ soc: t1, anchorMidUsd: 96_000 }]),
    }
  })(),
  (function () {
    const sourceSoc = "11-2021.00"
    const anchor = 125_000
    const salary = makeSalaryReady({
      onet_soc_code: sourceSoc,
      region_code: "US-TX",
      occupation_title: "Growth Marketing Manager",
      years_experience: 8,
      current_salary_usd: 132_000,
      anchorMidUsd: anchor,
    })
    const midBandMid = fixtureBandsFromAnchor(anchor).get("mid")!.salary_mid!
    const t1 = "11-2022.00"
    const mid1 = fixtureBandsFromAnchor(142_000).get("mid")!.salary_mid!
    return {
      personaId: "non-tech-marketing",
      label: "Non-tech marketing (fixture trajectory)",
      yearsExperience: 8,
      learningHoursPerWeek: 10,
      salary,
      adjacent: makeAdjacentReady({
        source_soc_code: sourceSoc,
        items: [
          adjItem({
            target_soc_code: t1,
            target_title: "Marketing Manager (fixture)",
            rank_position: 1,
            similarity_score: 0.64,
            bridge_skill_keys: ["sql", "data-analysis"],
            source_salary_mid: midBandMid,
            target_salary_mid: mid1,
            source_demand_delta_pct: 10,
            target_demand_delta_pct: 6,
          }),
        ],
      }),
      sourceBands: fixtureBandsFromAnchor(anchor),
      bandsByTarget: targetBandMaps([{ soc: t1, anchorMidUsd: 142_000 }]),
    }
  })(),
  (function () {
    const sourceSoc = "11-9199.00"
    const anchor = 95_000
    const salary = makeSalaryReady({
      onet_soc_code: sourceSoc,
      region_code: "US-WA",
      occupation_title: "Associate Product Manager",
      years_experience: 1.5,
      current_salary_usd: 92_000,
      anchorMidUsd: anchor,
    })
    const juniorMid = fixtureBandsFromAnchor(anchor).get("junior")!.salary_mid!
    const t1 = "11-1011.00"
    const mid1 = fixtureBandsFromAnchor(108_000).get("junior")!.salary_mid!
    return {
      personaId: "recent-grad-pm",
      label: "Recent grad PM (fixture trajectory)",
      yearsExperience: 1.5,
      learningHoursPerWeek: 4,
      salary,
      adjacent: makeAdjacentReady({
        source_soc_code: sourceSoc,
        items: [
          adjItem({
            target_soc_code: t1,
            target_title: "Chief Executives (fixture)",
            rank_position: 1,
            similarity_score: 0.41,
            bridge_skill_keys: ["financial-modeling"],
            source_salary_mid: juniorMid,
            target_salary_mid: mid1,
            source_demand_delta_pct: 14,
            target_demand_delta_pct: 3,
          }),
        ],
      }),
      sourceBands: fixtureBandsFromAnchor(anchor),
      bandsByTarget: targetBandMaps([{ soc: t1, anchorMidUsd: 108_000 }]),
    }
  })(),
]
