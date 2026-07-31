import type { SupabaseClient } from "@supabase/supabase-js"
import { PRIMARY_LANES } from "./research/lanes"

/**
 * The wire: every document the Researcher has collected, newest first.
 *
 * Paged by a cursor rather than an offset. The sweep inserts hundreds of rows
 * while someone is scrolling, and an offset would silently repeat and skip
 * items as the page numbers shift under it. The cursor is (ingested_at, id),
 * with id breaking ties because a single upsert stamps a whole batch with the
 * same timestamp.
 */

export const FEED_PAGE_SIZE = 30

export type FeedFilter = "all" | "primary" | "considered" | "unseen" | "used"

export type FeedSignal = {
  id: string
  title: string
  url: string | null
  snippet: string | null
  lane: string
  stance: string
  topic: string | null
  published_at: string | null
  ingested_at: string
  considered_at: string | null
  used_at: string | null
}

export type FeedPage = {
  signals: FeedSignal[]
  /** Opaque cursor for the next page; null when the end is reached. */
  cursor: string | null
}

const COLUMNS =
  "id,title,url,snippet,lane,stance,topics,published_at,ingested_at,considered_at,used_at"

function encodeCursor(row: { ingested_at: string; id: string }): string {
  return `${row.ingested_at}|${row.id}`
}

export async function loadFeedPage(
  supabase: SupabaseClient,
  userId: string,
  options: { filter?: FeedFilter; lane?: string; cursor?: string | null } = {},
): Promise<FeedPage> {
  const filter = options.filter ?? "all"

  let query = supabase
    .schema("creator")
    .from("creator_signals")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("ingested_at", { ascending: false })
    .order("id", { ascending: false })
    // One extra row, purely to find out whether another page exists without
    // paying for a count over a table that only grows.
    .limit(FEED_PAGE_SIZE + 1)

  if (options.lane) {
    query = query.eq("lane", options.lane)
  } else if (filter === "primary") {
    query = query.in("lane", PRIMARY_LANES)
  }

  if (filter === "considered") {
    // Read and passed over. The most interesting slice: a machine judged these
    // not worth a story, and the creator may well disagree.
    query = query.not("considered_at", "is", null).is("used_at", null)
  } else if (filter === "unseen") {
    query = query.is("considered_at", null)
  } else if (filter === "used") {
    query = query.not("used_at", "is", null)
  }

  if (options.cursor) {
    const [ingestedAt, id] = options.cursor.split("|")
    if (ingestedAt && id) {
      // Strictly after the cursor in (ingested_at desc, id desc) order.
      query = query.or(`ingested_at.lt.${ingestedAt},and(ingested_at.eq.${ingestedAt},id.lt.${id})`)
    }
  }

  const { data, error } = await query
  if (error) return { signals: [], cursor: null }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const hasMore = rows.length > FEED_PAGE_SIZE
  const page = hasMore ? rows.slice(0, FEED_PAGE_SIZE) : rows

  const signals: FeedSignal[] = page.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    url: (r.url as string) ?? null,
    snippet: (r.snippet as string) ?? null,
    lane: r.lane as string,
    stance: r.stance as string,
    topic: Array.isArray(r.topics) ? ((r.topics as string[])[0] ?? null) : null,
    published_at: (r.published_at as string) ?? null,
    ingested_at: r.ingested_at as string,
    considered_at: (r.considered_at as string) ?? null,
    used_at: (r.used_at as string) ?? null,
  }))

  const last = page.at(-1) as { ingested_at: string; id: string } | undefined

  return {
    signals,
    cursor: hasMore && last ? encodeCursor(last) : null,
  }
}

export type FeedCounts = { total: number; unseen: number; considered: number; used: number }

export async function loadFeedCounts(
  supabase: SupabaseClient,
  userId: string,
): Promise<FeedCounts> {
  const base = () =>
    supabase
      .schema("creator")
      .from("creator_signals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)

  const [total, unseen, used] = await Promise.all([
    base(),
    base().is("considered_at", null),
    base().not("used_at", "is", null),
  ])

  const totalCount = total.count ?? 0
  const unseenCount = unseen.count ?? 0
  const usedCount = used.count ?? 0

  return {
    total: totalCount,
    unseen: unseenCount,
    used: usedCount,
    considered: Math.max(0, totalCount - unseenCount - usedCount),
  }
}
