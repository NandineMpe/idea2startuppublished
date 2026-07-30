import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchReleases, sweepTopicAcrossLanes, type LaneSignal, type TopicStance } from "./lanes"

/**
 * Signal collection across every register the Researcher reads.
 *
 * Two axes, both deliberate:
 *
 *  - LANE: news, papers, releases, books, discussion. A thesis assembled from
 *    a preprint plus a press release is something the audience could not have
 *    reached alone; two headlines about the same event is not.
 *
 *  - STANCE: core topics are the ground the creator already owns; adjacent
 *    topics come from the canon's own `adjacent` field — the stretch surface.
 *    Sweeping both is what makes the output about where they should move,
 *    rather than only where they are.
 *
 * Entity extraction and embeddings stay deferred: at these volumes synthesis
 * reads the recent signals directly, so per-signal enrichment would be spend
 * without payoff. The columns exist for when that changes.
 */

// Counted in queries, not topics: one canon topic yields up to three.
const MAX_CORE_TOPICS = 8
const MAX_ADJACENT_TOPICS = 4

export type SweepResult = {
  topics_swept: number
  core_topics: number
  adjacent_topics: number
  signals_fetched: number
  signals_upserted: number
  by_lane: Record<string, number>
  errors: string[]
}

async function upsertSignals(
  supabase: SupabaseClient,
  userId: string,
  signals: LaneSignal[],
): Promise<{ upserted: number; error?: string }> {
  if (!signals.length) return { upserted: 0 }

  const rows = signals.map((s) => ({
    user_id: userId,
    source_key: s.source_key,
    source_item_id: s.source_item_id,
    title: s.title,
    url: s.url,
    published_at: s.published_at.toISOString(),
    snippet: s.body?.slice(0, 2000) ?? null,
    topics: [s.topic],
    lane: s.lane,
    stance: s.stance,
    raw_payload: s.raw_payload,
  }))

  const { error, count } = await supabase
    .schema("creator")
    .from("creator_signals")
    .upsert(rows, {
      onConflict: "user_id,source_key,source_item_id",
      ignoreDuplicates: true,
      count: "exact",
    })

  if (error) return { upserted: 0, error: error.message }
  return { upserted: count ?? rows.length }
}

/**
 * Sweep one topic and persist it.
 *
 * Exposed separately so the Inngest function can give each topic its own step,
 * and therefore its own execution window. Running nine topics inside a single
 * step meant one slow source — arXiv is regularly the slow one — could exhaust
 * the whole invocation and take every lane down with it.
 */
export async function sweepOneTopic(
  supabase: SupabaseClient,
  userId: string,
  topic: string,
  stance: TopicStance,
  hoursBack: number,
): Promise<{ fetched: number; upserted: number; by_lane: Record<string, number>; errors: string[] }> {
  const outcome = await sweepTopicAcrossLanes(topic, stance, hoursBack)
  const by_lane: Record<string, number> = {}
  for (const s of outcome.signals) by_lane[s.lane] = (by_lane[s.lane] ?? 0) + 1

  const { upserted, error } = await upsertSignals(supabase, userId, outcome.signals)
  const errors = [...outcome.errors]
  if (error) errors.push(`upsert: ${error}`)

  return { fetched: outcome.signals.length, upserted, by_lane, errors }
}

/** Lab and vendor releases are topic-independent — swept once per run. */
export async function sweepReleases(
  supabase: SupabaseClient,
  userId: string,
  hoursBack: number,
): Promise<{ fetched: number; upserted: number; errors: string[] }> {
  try {
    const releases = await fetchReleases(hoursBack)
    const { upserted, error } = await upsertSignals(supabase, userId, releases)
    return { fetched: releases.length, upserted, errors: error ? [`upsert: ${error}`] : [] }
  } catch (e) {
    return { fetched: 0, upserted: 0, errors: [e instanceof Error ? e.message : String(e)] }
  }
}

export async function sweepSignalsForUser(
  supabase: SupabaseClient,
  userId: string,
  topics: ResearchTopics,
  hoursBack = 48,
): Promise<SweepResult> {
  const result: SweepResult = {
    topics_swept: 0,
    core_topics: topics.core.length,
    adjacent_topics: topics.adjacent.length,
    signals_fetched: 0,
    signals_upserted: 0,
    by_lane: {},
    errors: [],
  }

  const plan: Array<{ topic: string; stance: TopicStance }> = [
    ...topics.core.map((topic) => ({ topic, stance: "core" as const })),
    ...topics.adjacent.map((topic) => ({ topic, stance: "adjacent" as const })),
  ]

  for (const { topic, stance } of plan) {
    let signals: LaneSignal[]
    try {
      const outcome = await sweepTopicAcrossLanes(topic, stance, hoursBack)
      signals = outcome.signals
      // Surfaced, not swallowed: a lane that returns nothing every run is a
      // broken adapter, and it is indistinguishable from a quiet week unless
      // the reason is recorded.
      for (const err of outcome.errors) result.errors.push(`${topic} / ${err}`)
    } catch (e) {
      result.errors.push(`${topic}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    result.topics_swept++
    result.signals_fetched += signals.length
    for (const s of signals) result.by_lane[s.lane] = (result.by_lane[s.lane] ?? 0) + 1

    const { upserted, error } = await upsertSignals(supabase, userId, signals)
    if (error) result.errors.push(`${topic} upsert: ${error}`)
    result.signals_upserted += upserted
  }

  // Lab and vendor releases are topic-independent — swept once, not per topic.
  try {
    const releases = await fetchReleases(hoursBack)
    result.signals_fetched += releases.length
    for (const s of releases) result.by_lane[s.lane] = (result.by_lane[s.lane] ?? 0) + 1
    const { upserted, error } = await upsertSignals(supabase, userId, releases)
    if (error) result.errors.push(`releases upsert: ${error}`)
    result.signals_upserted += upserted
  } catch (e) {
    result.errors.push(`releases: ${e instanceof Error ? e.message : String(e)}`)
  }

  return result
}

export type ResearchTopics = { core: string[]; adjacent: string[] }

/**
 * What to search on.
 *
 * The derived canon wins when it exists: its topics are weighted by what the
 * creator actually publishes, and its `adjacent` lists are the stretch surface
 * the derivation identified. Declared settings topics are the stopgap before
 * a corpus exists, and have no adjacency of their own.
 */
export async function loadResearchTopics(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResearchTopics> {
  const { data: canon } = await supabase
    .schema("creator")
    .from("creator_canon")
    .select("topics")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const canonTopics = Array.isArray(canon?.topics)
    ? (canon.topics as Array<{
        label?: string
        weight?: number
        adjacent?: string[]
        search_queries?: string[]
      }>)
    : []

  if (canonTopics.length) {
    const ranked = [...canonTopics].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    // Prefer the queries the derivation wrote for searching; the label is for
    // display and is usually unsearchable ("Big Four, audit & accounting
    // disruption" returns nothing anywhere, including news).
    const core = ranked
      .flatMap((t) =>
        Array.isArray(t.search_queries) && t.search_queries.length
          ? t.search_queries
          : t.label
            ? [t.label]
            : [],
      )
      .filter(Boolean)
      .slice(0, MAX_CORE_TOPICS)

    // Adjacency is drawn from the heaviest topics first: the stretch that
    // matters is the one next to where the creator already has authority.
    const adjacent = [
      ...new Set(ranked.flatMap((t) => (Array.isArray(t.adjacent) ? t.adjacent : []))),
    ]
      .filter((label) => label && !core.includes(label))
      .slice(0, MAX_ADJACENT_TOPICS)

    return { core, adjacent }
  }

  const { data: settings } = await supabase
    .schema("creator")
    .from("creator_settings")
    .select("niche_topics")
    .eq("user_id", userId)
    .maybeSingle()

  return { core: (settings?.niche_topics ?? []).slice(0, MAX_CORE_TOPICS), adjacent: [] }
}
