import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "../query"
import { researchTopicsBlocker } from "../load-stories"
import type { CreatorBlocker } from "../types"
import { INDUSTRY_SEEDS, MIN_LEADING_TO_FORECAST, MIN_SIGNALS_TO_BUILD } from "./definitions"
import { countByBand, loadScorableSignals, selectFromRows } from "./select"
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
  /**
   * What is in the corpus for this industry right now, whether or not it has
   * ever been built.
   *
   * On the card rather than in the build, because "there is not enough evidence
   * yet" has to be visible before she spends a model pass finding out. An
   * industry the sweep has never collected for looks identical to a rich one
   * until you press the button, and that is the whole reason the first version
   * of this screen was half a feature.
   */
  available: number
  available_leading: number
  last_swept_at: string | null
}

// Re-exported so the card can import its thresholds alongside its type. They
// live in definitions because build.ts needs them too, and importing them from
// here would put a cycle between load and build.
export { MIN_LEADING_TO_FORECAST, MIN_SIGNALS_TO_BUILD }

/** The stored columns, without the counts computed on read. */
type IndustryRow = Omit<CreatorIndustry, "available" | "available_leading"> & { id: string }

const INDUSTRY_COLUMNS =
  // One literal, never concatenated: PostgREST parses this at the type level and
  // a `+` collapses every row to unknown.
  "id,slug,label,audience,baseline,match_terms,headline,arc,indicators,shifts,open_questions,built_from,built_at,last_swept_at"

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
  // The signal corpus is read once and scored fourteen times in memory rather
  // than re-queried per industry.
  const [rows, blocker, signalRows] = await Promise.all([
    safeRows<IndustryRow>(
      supabase
        .schema("creator")
        .from("creator_industries")
        .select(INDUSTRY_COLUMNS)
        .eq("user_id", userId)
        .is("deleted_at", null),
    ),
    researchTopicsBlocker(supabase, userId),
    loadScorableSignals(supabase, userId),
  ])

  function evidence(matchTerms: string[], weakTerms: string[]): { available: number; available_leading: number } {
    const selected = selectFromRows(signalRows, matchTerms, weakTerms)
    return {
      available: selected.length,
      available_leading: countByBand(selected).ahead,
    }
  }

  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const industries: CreatorIndustry[] = INDUSTRY_SEEDS.map((seed) => {
    const row = bySlug.get(seed.slug)
    const terms = row?.match_terms?.length ? row.match_terms : seed.match_terms
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
        last_swept_at: null,
        ...evidence(terms, seed.weak_terms ?? []),
      }
    }
    return {
      ...row,
      arc: Array.isArray(row.arc) ? row.arc : [],
      indicators: Array.isArray(row.indicators) ? row.indicators : [],
      shifts: Array.isArray(row.shifts) ? row.shifts : [],
      open_questions: Array.isArray(row.open_questions) ? row.open_questions : [],
      built_from: row.built_from ?? {},
      ...evidence(terms, seed.weak_terms ?? []),
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
        ...evidence(row.match_terms ?? [], []),
      })
    }
  }

  // Built first and most recent first, then the ones that could be built now,
  // then the ones still collecting. An unbuilt industry is a to-do, and a to-do
  // she cannot action yet belongs below the ones she can.
  industries.sort((a, b) => {
    if (a.built_at || b.built_at) return (b.built_at ?? "").localeCompare(a.built_at ?? "")
    const aReady = a.available >= MIN_SIGNALS_TO_BUILD
    const bReady = b.available >= MIN_SIGNALS_TO_BUILD
    if (aReady !== bReady) return aReady ? -1 : 1
    return b.available - a.available
  })

  return { industries, blocker }
}
