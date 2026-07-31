"use server"

import { revalidatePath } from "next/cache"
import { requireCreatorUser } from "./auth"
import { sendCreatorEvent } from "./inngest/client"
import { isMissingRelation } from "./query"
import { DEFAULT_CREATOR_SETTINGS, isSupportedCurrency } from "./load-settings"

export type SettingsActionResult = { ok: true } | { ok: false; error: string }

function parsePositiveNumber(value: FormDataEntryValue | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function updateCreatorSettings(formData: FormData): Promise<SettingsActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const currencyRaw = formData.get("currency")
  const currency = isSupportedCurrency(currencyRaw) ? currencyRaw : DEFAULT_CREATOR_SETTINGS.currency

  const cpmLow = parsePositiveNumber(formData.get("cpm_low"), DEFAULT_CREATOR_SETTINGS.cpm_low)
  const cpmHigh = parsePositiveNumber(formData.get("cpm_high"), DEFAULT_CREATOR_SETTINGS.cpm_high)

  if (cpmHigh < cpmLow) {
    return { ok: false, error: "The upper CPM must be at or above the lower CPM." }
  }

  const handleRaw = formData.get("tiktok_handle")
  const handle = typeof handleRaw === "string" && handleRaw.trim() ? handleRaw.trim().replace(/^@/, "") : null

  const topicsRaw = formData.get("niche_topics")
  const nicheTopics =
    typeof topicsRaw === "string"
      ? [...new Set(topicsRaw.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))].slice(0, 8)
      : []

  // "Name — what it is good for", one per line. The visual planner routes every
  // shot to one of these, so an undeclared tool means a plan full of things the
  // creator cannot actually make.
  const toolsRaw = formData.get("visual_tools")
  const visualTools =
    typeof toolsRaw === "string"
      ? toolsRaw
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 20)
          .map((line) => {
            const [namePart, ...rest] = line.split(/\s+[—-]\s+/)
            const name = namePart.trim()
            const url = name.match(/\b([a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?)/i)?.[1] ?? null
            return { name, url: url ? (url.startsWith("http") ? url : `https://${url}`) : null, good_for: rest.join(" - ").trim() || null }
          })
      : []

  const { error } = await supabase
    .schema("creator")
    .from("creator_settings")
    .upsert(
      {
        user_id: userId,
        currency,
        cpm_low: cpmLow,
        cpm_high: cpmHigh,
        tiktok_handle: handle,
        niche_topics: nicheTopics,
        visual_tools: visualTools,
      },
      { onConflict: "user_id" },
    )

  if (error) {
    if (isMissingRelation(error)) {
      return { ok: false, error: "Settings cannot be saved until the creator schema migration is applied." }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/creator/dashboard/settings")
  revalidatePath("/creator/dashboard/worth")

  return { ok: true }
}

export type StoryActionResult = { ok: true } | { ok: false; error: string }

export type BinEntity = "story" | "work" | "thread"

const TABLE_FOR: Record<BinEntity, string> = {
  story: "creator_stories",
  work: "creator_work",
  thread: "creator_threads",
}

/** Every screen a story or work item can appear on. Cheap, and none of them can go stale. */
const CREATOR_PATHS = [
  "/creator/dashboard",
  "/creator/dashboard/stories",
  "/creator/dashboard/next",
  "/creator/dashboard/opportunities",
  "/creator/dashboard/threads",
  "/creator/dashboard/settings",
]

function revalidateCreator(): void {
  for (const path of CREATOR_PATHS) revalidatePath(path)
}

/**
 * A story and the Desk item it was promoted to are one thing to the creator,
 * so an action on either has to move both. Otherwise clearing a story leaves an
 * orphan waiting for a decision on the Desk, and the two screens disagree about
 * what is still outstanding.
 */
async function linkedPair(
  supabase: Awaited<ReturnType<typeof requireCreatorUser>>["supabase"],
  userId: string,
  entity: BinEntity,
  id: string,
): Promise<
  { ok: true; storyIds: string[]; workIds: string[]; threadIds: string[] } | { ok: false; error: string }
> {
  if (entity === "thread") {
    // A thread's Desk item goes with it, same as a story's. Otherwise closing a
    // file leaves an "Update: ..." card waiting for a decision on a story the
    // creator has just said they are done with.
    const { data, error } = await supabase
      .schema("creator")
      .from("creator_threads")
      .select("work_item_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: "Thread not found." }
    return {
      ok: true,
      storyIds: [],
      workIds: data.work_item_id ? [data.work_item_id] : [],
      threadIds: [id],
    }
  }

  if (entity === "story") {
    const { data, error } = await supabase
      .schema("creator")
      .from("creator_stories")
      .select("work_item_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle()
    if (error) return { ok: false, error: error.message }
    if (!data) return { ok: false, error: "Story not found." }
    return { ok: true, storyIds: [id], workIds: data.work_item_id ? [data.work_item_id] : [], threadIds: [] }
  }

  const { data, error } = await supabase
    .schema("creator")
    .from("creator_stories")
    .select("id")
    .eq("work_item_id", id)
    .eq("user_id", userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, storyIds: (data ?? []).map((row) => row.id as string), workIds: [id], threadIds: [] }
}

async function applyToPair(
  entity: BinEntity,
  id: string,
  patch: Record<string, unknown>,
): Promise<StoryActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const pair = await linkedPair(supabase, userId, entity, id)
  if (!pair.ok) return pair

  if (pair.storyIds.length) {
    const { error } = await supabase
      .schema("creator")
      .from("creator_stories")
      .update(patch)
      .eq("user_id", userId)
      .in("id", pair.storyIds)
    if (error) return { ok: false, error: error.message }
  }

  if (pair.workIds.length) {
    const { error } = await supabase
      .schema("creator")
      .from("creator_work")
      .update(patch)
      .eq("user_id", userId)
      .in("id", pair.workIds)
    if (error) return { ok: false, error: error.message }
  }

  if (pair.threadIds.length) {
    // Threads have their own state vocabulary and no decided_at, so anything
    // meant for the other two tables is stripped rather than sent and rejected.
    const threadPatch = { ...patch }
    delete threadPatch.decided_at
    if (threadPatch.state === "archived") threadPatch.state = "closed"

    const { error } = await supabase
      .schema("creator")
      .from("creator_threads")
      .update(threadPatch)
      .eq("user_id", userId)
      .in("id", pair.threadIds)
    if (error) return { ok: false, error: error.message }
  }

  revalidateCreator()
  return { ok: true }
}

/**
 * Archive: handled, take it off the screen, but keep it working.
 *
 * The thesis of an archived story still sits in the synthesis do-not-repeat
 * list and an archived move still counts against re-proposing the same idea, so
 * archiving is how the creator says "seen it" without inviting it back next
 * week. For a thread it means closing the file: it stops being checked, and it
 * stays readable. That is the whole difference from delete.
 */
export async function archiveCreatorItem(entity: BinEntity, id: string): Promise<StoryActionResult> {
  return applyToPair(entity, id, { state: "archived", decided_at: new Date().toISOString() })
}

/**
 * Delete: this should not have existed.
 *
 * Soft, because none of these rows come back by re-running anything — the
 * signals behind a story have aged out of the search window and a regenerated
 * draft is a different draft. It leaves every screen and every dedupe list
 * immediately, and waits in Recently deleted for the retention window.
 */
export async function moveToBin(entity: BinEntity, id: string): Promise<StoryActionResult> {
  return applyToPair(entity, id, { deleted_at: new Date().toISOString() })
}

export async function restoreFromBin(entity: BinEntity, id: string): Promise<StoryActionResult> {
  return applyToPair(entity, id, { deleted_at: null })
}

/**
 * The one irreversible action in the set, which is why it is only reachable
 * from Recently deleted and never from a card.
 *
 * Stories go first: creator_stories.work_item_id is ON DELETE SET NULL, so
 * removing the work row first would sever the link before we could follow it.
 */
export async function deleteForever(entity: BinEntity, id: string): Promise<StoryActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const pair = await linkedPair(supabase, userId, entity, id)
  if (!pair.ok) return pair

  // Threads before work: creator_threads.work_item_id is ON DELETE SET NULL,
  // so removing the work row first severs the link before we can follow it.
  for (const [table, ids] of [
    ["creator_threads", pair.threadIds],
    ["creator_stories", pair.storyIds],
    ["creator_work", pair.workIds],
  ] as const) {
    if (!ids.length) continue
    const { error } = await supabase
      .schema("creator")
      .from(table)
      .delete()
      .eq("user_id", userId)
      .in("id", ids)
    if (error) return { ok: false, error: error.message }
  }

  revalidateCreator()
  return { ok: true }
}

export async function emptyRecycleBin(): Promise<StoryActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const { error: storyError } = await supabase
    .schema("creator")
    .from("creator_stories")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
  if (storyError) return { ok: false, error: storyError.message }

  const { error: threadError } = await supabase
    .schema("creator")
    .from("creator_threads")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
  if (threadError) return { ok: false, error: threadError.message }

  const { error: workError } = await supabase
    .schema("creator")
    .from("creator_work")
    .delete()
    .eq("user_id", userId)
    .not("deleted_at", "is", null)
  if (workError) return { ok: false, error: workError.message }

  revalidateCreator()
  return { ok: true }
}

export type DeleteContentResult = { ok: true; deleted: number } | { ok: false; error: string }

/**
 * Remove posts from the corpus.
 *
 * A hard delete rather than a bin: every field is recoverable by re-importing
 * the same URL, so a soft-delete flag would add a filter to every corpus query
 * to protect nothing. What is not recoverable is the canon derived from the old
 * corpus, so a re-derivation is queued — the canon must never describe posts
 * that are no longer there. Its debounce collapses a burst of deletes into one.
 */
export async function deleteCreatorContent(contentIds: string[]): Promise<DeleteContentResult> {
  const { supabase, userId } = await requireCreatorUser()

  const ids = contentIds.filter((id) => typeof id === "string" && id.length > 0)
  if (!ids.length) return { ok: false, error: "Nothing selected." }

  const { data, error } = await supabase
    .schema("creator")
    .from("creator_content")
    .delete()
    .eq("user_id", userId)
    .in("id", ids)
    .select("id")

  if (error) return { ok: false, error: error.message }

  const deleted = data?.length ?? 0

  if (deleted > 0) {
    try {
      await sendCreatorEvent({ name: "creator/canon.derive", data: { user_id: userId } })
    } catch (e) {
      // A stale canon is worth surfacing, but not worth failing the delete over.
      console.warn("[creator-actions] canon.derive after delete failed:", e instanceof Error ? e.message : e)
    }
  }

  revalidatePath("/creator/dashboard/content")
  revalidatePath("/creator/dashboard/canon")
  revalidatePath("/creator/dashboard/worth")

  return { ok: true, deleted }
}

/**
 * The creator's decision on an agent proposal: approve or kill. RLS scopes the
 * update to their own rows; the linked story (if any) is moved with it so the
 * Stories screen and the Desk never disagree.
 */
export async function decideCreatorWork(
  workId: string,
  decision: "approved" | "killed",
): Promise<SettingsActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const { data: workRow, error: loadError } = await supabase
    .schema("creator")
    .from("creator_work")
    .select("kind,provenance")
    .eq("id", workId)
    .eq("user_id", userId)
    .maybeSingle()
  if (loadError) return { ok: false, error: loadError.message }
  if (!workRow) return { ok: false, error: "Work item not found." }

  const { error } = await supabase
    .schema("creator")
    .from("creator_work")
    .update({ state: decision, decided_at: new Date().toISOString() })
    .eq("id", workId)
    .eq("user_id", userId)
  if (error) return { ok: false, error: error.message }

  const { error: storyError } = await supabase
    .schema("creator")
    .from("creator_stories")
    .update({ state: decision, decided_at: new Date().toISOString() })
    .eq("work_item_id", workId)
    .eq("user_id", userId)
  if (storyError) return { ok: false, error: storyError.message }

  // The swarm hook: approving a Researcher story commissions the Writer.
  const storyId = (workRow.provenance as { story_id?: string } | null)?.story_id
  if (decision === "approved" && workRow.kind === "insight" && storyId) {
    try {
      await sendCreatorEvent({
        name: "creator/writer.draft",
        data: { user_id: userId, story_id: storyId },
      })
    } catch (e) {
      console.warn("[creator-actions] writer.draft event failed:", e instanceof Error ? e.message : e)
    }
  }

  revalidatePath("/creator/dashboard")
  revalidatePath("/creator/dashboard/stories")
  revalidatePath("/creator/dashboard/opportunities")

  return { ok: true }
}
