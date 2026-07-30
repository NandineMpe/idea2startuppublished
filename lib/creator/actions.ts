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
