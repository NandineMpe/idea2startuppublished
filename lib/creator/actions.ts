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
