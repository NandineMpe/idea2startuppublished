import type { SupabaseClient } from "@supabase/supabase-js"
import { safeRows } from "./query"
import type { WorkKind } from "./types"

/**
 * Recently deleted.
 *
 * A deleted story or draft is not recoverable by re-running anything — the
 * signals it was synthesised from have aged out of the search window, and a
 * regenerated draft is a different draft. So delete stamps deleted_at, the row
 * leaves every screen, and it waits here.
 */

export const RECYCLE_BIN_DAYS = 30

export type BinnedItem = {
  entity: "story" | "work"
  id: string
  title: string
  /** What it was, in the creator's words: "Story", "Draft", "Deal". */
  label: string
  deleted_at: string
  /** True once the linked partner row rides along, so the copy can say so. */
  has_linked_work: boolean
}

const WORK_LABELS: Record<string, string> = {
  draft: "Draft",
  insight: "Insight",
  deal: "Deal",
  event: "Event",
  move: "Move",
}

type BinnedStoryRow = { id: string; thesis: string; deleted_at: string; work_item_id: string | null }
type BinnedWorkRow = { id: string; kind: WorkKind; title: string; deleted_at: string }

function cutoff(): string {
  return new Date(Date.now() - RECYCLE_BIN_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Purge on read rather than on a cron.
 *
 * The screen promises a thirty day window, and the only place that promise is
 * observable is this screen. Purging here means the promise cannot drift from
 * what a scheduled job did or did not manage to run, and it costs one indexed
 * delete against a set that is nearly always empty.
 */
async function purgeExpired(supabase: SupabaseClient, userId: string): Promise<void> {
  const expiredBefore = cutoff()
  await Promise.all([
    supabase
      .schema("creator")
      .from("creator_stories")
      .delete()
      .eq("user_id", userId)
      .lt("deleted_at", expiredBefore),
    supabase
      .schema("creator")
      .from("creator_work")
      .delete()
      .eq("user_id", userId)
      .lt("deleted_at", expiredBefore),
  ])
}

export async function loadRecycleBin(
  supabase: SupabaseClient,
  userId: string,
): Promise<BinnedItem[]> {
  await purgeExpired(supabase, userId)

  const [stories, work] = await Promise.all([
    safeRows<BinnedStoryRow>(
      supabase
        .schema("creator")
        .from("creator_stories")
        .select("id,thesis,deleted_at,work_item_id")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(100),
    ),
    safeRows<BinnedWorkRow>(
      supabase
        .schema("creator")
        .from("creator_work")
        .select("id,kind,title,deleted_at")
        .eq("user_id", userId)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(100),
    ),
  ])

  // A story and its Desk item are one thing to the creator, so the pair is
  // listed once, under the story. Listing both would offer a restore that only
  // half works.
  const ridingAlong = new Set(stories.map((s) => s.work_item_id).filter(Boolean) as string[])

  const items: BinnedItem[] = [
    ...stories.map((s) => ({
      entity: "story" as const,
      id: s.id,
      title: s.thesis,
      label: "Story",
      deleted_at: s.deleted_at,
      has_linked_work: Boolean(s.work_item_id),
    })),
    ...work
      .filter((w) => !ridingAlong.has(w.id))
      .map((w) => ({
        entity: "work" as const,
        id: w.id,
        title: w.title,
        label: WORK_LABELS[w.kind] ?? "Item",
        deleted_at: w.deleted_at,
        has_linked_work: false,
      })),
  ]

  return items.sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))
}

/** Days left before this row is purged, floored at zero. */
export function daysLeft(deletedAt: string): number {
  const elapsed = (Date.now() - new Date(deletedAt).getTime()) / (24 * 60 * 60 * 1000)
  return Math.max(0, Math.ceil(RECYCLE_BIN_DAYS - elapsed))
}
