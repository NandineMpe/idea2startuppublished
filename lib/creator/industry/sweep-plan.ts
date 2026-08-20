import type { SupabaseClient } from "@supabase/supabase-js"
import { INDUSTRY_SEEDS } from "./definitions"

/**
 * Which industries this run collects for, and what it searches.
 *
 * The screen lists fourteen industries. Sweeping all of them across twenty-two
 * lanes every run is roughly forty topic sweeps on top of the creator's own,
 * which is not affordable and would push the run past its execution window long
 * before it was interesting. So each run takes the few whose evidence is
 * stalest and leaves the rest for the next one.
 *
 * Rotation rather than priority on purpose. Any fixed ordering means the
 * industries at the bottom are never collected for and therefore never become
 * buildable, which is indistinguishable from not having added them. Sorting by
 * how long it has been makes every industry reach the front eventually, and an
 * industry that has never been swept always sorts first.
 */

/**
 * Industries per run.
 *
 * Four industries at up to three queries each is twelve topic sweeps, against
 * the eighteen the creator's own core, adjacent and horizon topics already
 * cost. It roughly doubles a run, which is the most that can be justified for
 * material that is not about her directly, and it means the full rotation
 * completes in four presses.
 */
export const INDUSTRIES_PER_SWEEP = 4

/** Queries per industry, matching what a canon topic is allowed to expand to. */
export const MAX_QUERIES_PER_INDUSTRY = 3

export type IndustrySweepTarget = {
  slug: string
  label: string
  queries: string[]
}

type IndustryRow = {
  slug: string
  label: string
  search_queries: string[] | null
  last_swept_at: string | null
}

/**
 * The stalest few industries and the queries to run for them.
 *
 * Reads the seeds and the rows together. An industry she has never built has no
 * row yet, and it is precisely the one most in need of collection, so a missing
 * row is treated as never swept rather than skipped.
 */
export async function planIndustrySweep(
  supabase: SupabaseClient,
  userId: string,
  limit: number = INDUSTRIES_PER_SWEEP,
): Promise<IndustrySweepTarget[]> {
  const { data } = await supabase
    .schema("creator")
    .from("creator_industries")
    .select("slug,label,search_queries,last_swept_at")
    .eq("user_id", userId)
    .is("deleted_at", null)

  const rows = (data ?? []) as IndustryRow[]
  const bySlug = new Map(rows.map((r) => [r.slug, r]))

  const candidates: Array<IndustrySweepTarget & { last_swept_at: string | null }> = []

  for (const seed of INDUSTRY_SEEDS) {
    const row = bySlug.get(seed.slug)
    // Null means inherit the seed's queries; an empty array means she cleared
    // them deliberately, and a cleared industry is not swept.
    const queries = row?.search_queries ?? seed.search_queries
    if (!queries.length) continue
    candidates.push({
      slug: seed.slug,
      label: row?.label ?? seed.label,
      queries: queries.slice(0, MAX_QUERIES_PER_INDUSTRY),
      last_swept_at: row?.last_swept_at ?? null,
    })
  }

  // Industries she added herself, which are not in the seed list.
  for (const row of rows) {
    if (INDUSTRY_SEEDS.some((s) => s.slug === row.slug)) continue
    const queries = row.search_queries ?? []
    if (!queries.length) continue
    candidates.push({
      slug: row.slug,
      label: row.label,
      queries: queries.slice(0, MAX_QUERIES_PER_INDUSTRY),
      last_swept_at: row.last_swept_at,
    })
  }

  // Never swept first, then longest ago. Ties broken by slug so a run is
  // reproducible and two industries cannot swap places between attempts.
  candidates.sort((a, b) => {
    if (a.last_swept_at === b.last_swept_at) return a.slug.localeCompare(b.slug)
    if (!a.last_swept_at) return -1
    if (!b.last_swept_at) return 1
    return a.last_swept_at.localeCompare(b.last_swept_at)
  })

  return candidates.slice(0, limit).map(({ slug, label, queries }) => ({ slug, label, queries }))
}

/**
 * Record that an industry was collected for.
 *
 * Upserted from the sweep rather than seeded by the migration: a migration
 * reapplies on every deploy, so seeding rows there would overwrite her edited
 * match terms and queries each time. This writes only the sweep clock and the
 * identity, and leaves everything she can edit alone.
 */
export async function markIndustrySwept(
  supabase: SupabaseClient,
  userId: string,
  slug: string,
): Promise<void> {
  const now = new Date().toISOString()

  // Update first, insert only if there was nothing to update. An upsert would
  // have to name `label` to satisfy the not-null column, and naming it means
  // writing it, which would silently rename an industry she had relabelled
  // every time the sweep touched it.
  const { data: updated } = await supabase
    .schema("creator")
    .from("creator_industries")
    .update({ last_swept_at: now, updated_at: now })
    .eq("user_id", userId)
    .eq("slug", slug)
    .select("slug")

  if (updated?.length) return

  const seed = INDUSTRY_SEEDS.find((s) => s.slug === slug)
  const { error } = await supabase
    .schema("creator")
    .from("creator_industries")
    .insert({
      user_id: userId,
      slug,
      label: seed?.label ?? slug,
      audience: seed?.audience ?? null,
      baseline: seed?.baseline ?? null,
      match_terms: seed?.match_terms ?? [],
      last_swept_at: now,
    })

  if (error) {
    // Never fatal. Losing the clock costs one industry its turn in the
    // rotation; throwing here would cost the whole sweep the signals it just
    // collected, which are already saved.
    console.warn(`[creator-industry] could not mark ${slug} swept:`, error.message)
  }
}
