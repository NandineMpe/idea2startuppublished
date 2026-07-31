"use server"

import { revalidatePath } from "next/cache"
import { requireCreatorUser } from "@/lib/creator/auth"
import { isMissingRelation } from "@/lib/creator/query"

export type TrajectoryActionResult = { ok: true } | { ok: false; error: string }

function toList(value: FormDataEntryValue | null, limit: number): string[] {
  if (typeof value !== "string") return []
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].slice(0, limit)
}

/**
 * Save the declaration.
 *
 * The derived half of the row is deliberately untouched here. A creator editing
 * the wording of their north star should not lose the strategy that was built
 * against it, and the screen shows when the strategy was last derived so a
 * stale one is visible rather than silently replaced.
 */
export async function saveTrajectory(formData: FormData): Promise<TrajectoryActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const northStar = String(formData.get("north_star") ?? "").trim()
  if (northStar.length < 12) {
    return { ok: false, error: "Say where you are going in a sentence the agents can work from." }
  }

  const horizonRaw = Number(formData.get("horizon_months"))
  const horizonMonths = Number.isFinite(horizonRaw) && horizonRaw >= 1 && horizonRaw <= 60 ? Math.round(horizonRaw) : 12

  const target = String(formData.get("target_audience") ?? "").trim()
  const serves = String(formData.get("what_it_serves") ?? "").trim()
  const basedIn = String(formData.get("based_in") ?? "").trim()
  const audienceNow = String(formData.get("audience_now") ?? "").trim()

  // Comma or newline: a list of countries is the one field people reliably type
  // on one line, and rejecting that would be pedantry.
  const marketsRaw = formData.get("target_markets")
  const targetMarkets =
    typeof marketsRaw === "string"
      ? [...new Set(marketsRaw.split(/[,\n]/).map((m) => m.trim()).filter(Boolean))].slice(0, 8)
      : []

  const { data: existing } = await supabase
    .schema("creator")
    .from("creator_trajectory")
    .select("id")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    north_star: northStar,
    target_audience: target || null,
    what_it_serves: serves || null,
    based_in: basedIn || null,
    target_markets: targetMarkets,
    audience_now: audienceNow || null,
    horizon_months: horizonMonths,
    positions_to_claim: toList(formData.get("positions_to_claim"), 8),
    off_strategy: toList(formData.get("off_strategy"), 8),
  }

  const { error } = existing
    ? await supabase
        .schema("creator")
        .from("creator_trajectory")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId)
    : await supabase
        .schema("creator")
        .from("creator_trajectory")
        .insert({ user_id: userId, version: 1, ...payload })

  if (error) {
    if (isMissingRelation(error)) {
      return { ok: false, error: "This cannot be saved until the creator schema migration is applied." }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath("/creator/dashboard/trajectory")
  revalidatePath("/creator/dashboard")

  return { ok: true }
}
