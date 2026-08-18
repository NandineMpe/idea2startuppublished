import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "../query"
import { researchTopicsBlocker } from "../load-stories"
import type { CreatorBlocker } from "../types"
import { INDUSTRY_SEEDS } from "./definitions"
import type { IndustryArcPoint, IndustryIndicator, IndustryShift } from "./build"

export type CreatorIndustry = {
  id: string | null
  slug: string
  label: string
  audience: string | null
  baseline: string | null
  match_terms: string[]
  headline: string | null
  arc: IndustryArcPoint[]
  indicators: IndustryIndicator[]
  shifts: IndustryShift[]
  open_questions: string[]
  built_from: Record<string, number>
  built_at: string | null
}

const INDUSTRY_COLUMNS =
  // One literal, never concatenated: PostgREST parses this at the type level and
  // a `+` collapses every row to unknown.
  "id,slug,label,audience,baseline,match_terms,headline,arc,indicators,shifts,open_questions,built_from,built_at"

export type IndustryContext = {
  industries: CreatorIndustry[]
  blocker: CreatorBlocker | null
}

/**
 * Every industry, built or not.
 *
 * Unbuilt ones are returned from the seed definitions rather than hidden, so the
 * screen shows what it could cover and not only what it has covered. An empty
 * page would read as a broken feature rather than as work waiting to be done.
 */
export async function loadIndustries(
  supabase: SupabaseClient,
  userId: string,
): Promise<IndustryContext> {
  const [rows, blocker] = await Promise.all([
    safeRows<CreatorIndustry & { id: string }>(
      supabase
        .schema("creator")
        .from("creator_industries")
        .select(INDUSTRY_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null),
    ),
    researchTopicsBlocker(supabase, userId),
  ])

  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const industries: CreatorIndustry[] = INDUSTRY_SEEDS.map((seed) => {
    const row = bySlug.get(seed.slug)
    if (!row) {
      return {
        id: null,
        slug: seed.slug,
        label: seed.label,
        audience: seed.audience,
        baseline: seed.baseline,
        match_terms: seed.match_terms,
        headline: null,
        arc: [],
        indicators: [],
        shifts: [],
        open_questions: [],
        built_from: {},
        built_at: null,
      }
    }
    return {
      ...row,
      arc: Array.isArray(row.arc) ? row.arc : [],
      indicators: Array.isArray(row.indicators) ? row.indicators : [],
      shifts: Array.isArray(row.shifts) ? row.shifts : [],
      open_questions: Array.isArray(row.open_questions) ? row.open_questions : [],
      built_from: row.built_from ?? {},
    }
  })

  // Anything she added herself that is not a seed still belongs on the screen.
  for (const row of rows) {
    if (!INDUSTRY_SEEDS.some((s) => s.slug === row.slug)) {
      industries.push({
        ...row,
        arc: Array.isArray(row.arc) ? row.arc : [],
        indicators: Array.isArray(row.indicators) ? row.indicators : [],
        shifts: Array.isArray(row.shifts) ? row.shifts : [],
        open_questions: Array.isArray(row.open_questions) ? row.open_questions : [],
        built_from: row.built_from ?? {},
      })
    }
  }

  // Built first, most recent first. An unbuilt industry is a to-do, not a result.
  industries.sort((a, b) => (b.built_at ?? "").localeCompare(a.built_at ?? ""))

  return { industries, blocker }
}
