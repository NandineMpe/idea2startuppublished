"use server"

import { revalidatePath } from "next/cache"
import { requireCreatorUser } from "../auth"
import { PROTOCOL_BY_KEY, type Presentation } from "./protocols"

export type BrandActionResult = { ok: true } | { ok: false; error: string }

const PRESENTATIONS: Presentation[] = ["masculine", "feminine", "androgynous"]

function optionalNumber(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || !v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function optionalText(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

/** The date everything else is scheduled backwards from, plus how she presents. */
export async function updateBrandBasics(formData: FormData): Promise<BrandActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const shootRaw = formData.get("next_shoot_at")
  // Blank clears it. An empty shoot date and a shoot date in the past are
  // different states and only one of them should silently persist.
  const nextShoot = typeof shootRaw === "string" && shootRaw.trim() ? shootRaw.trim() : null

  const presRaw = formData.get("presentation")
  const presentation =
    typeof presRaw === "string" && PRESENTATIONS.includes(presRaw as Presentation)
      ? (presRaw as Presentation)
      : null

  const { error } = await supabase
    .schema("creator")
    .from("creator_settings")
    .upsert(
      { user_id: userId, next_shoot_at: nextShoot, presentation, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath("/creator/dashboard/brand")
  return { ok: true }
}

/**
 * Save one protocol.
 *
 * Upserted from the seed on first save rather than pre-seeded for everyone: the
 * catalogue is a menu until she says otherwise, and thirteen rows written on
 * signup would make "active" meaningless.
 */
export async function saveProtocol(formData: FormData): Promise<BrandActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const key = optionalText(formData.get("protocol_key"))
  if (!key) return { ok: false, error: "Missing protocol." }

  const seed = PROTOCOL_BY_KEY.get(key)
  const label = optionalText(formData.get("label")) ?? seed?.label ?? key

  const lead = optionalNumber(formData.get("lead_days_before_camera"))
  const peak = optionalNumber(formData.get("peak_days_after"))
  const repeatRaw = formData.get("repeat_weeks")
  const repeat = optionalNumber(repeatRaw)

  const { error } = await supabase
    .schema("creator")
    .from("creator_brand_protocols")
    .upsert(
      {
        user_id: userId,
        protocol_key: key,
        label,
        category: seed?.category ?? "skin",
        active: formData.get("active") === "on" || formData.get("active") === "true",
        lead_days_before_camera: lead ?? seed?.lead_days_before_camera ?? 0,
        peak_days_after: peak ?? seed?.peak_days_after ?? 0,
        repeat_weeks: repeat ?? seed?.repeat_weeks ?? null,
        last_paid: optionalNumber(formData.get("last_paid")),
        best_quote: optionalNumber(formData.get("best_quote")),
        provider: optionalText(formData.get("provider")),
        last_done_at: optionalText(formData.get("last_done_at")),
        notes: optionalText(formData.get("notes")),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,protocol_key" },
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath("/creator/dashboard/brand")
  return { ok: true }
}

/** Mark a treatment done today, which is the only edit that happens in a hurry. */
export async function markProtocolDone(protocolKey: string): Promise<BrandActionResult> {
  const { supabase, userId } = await requireCreatorUser()
  const seed = PROTOCOL_BY_KEY.get(protocolKey)

  const { error } = await supabase
    .schema("creator")
    .from("creator_brand_protocols")
    .upsert(
      {
        user_id: userId,
        protocol_key: protocolKey,
        label: seed?.label ?? protocolKey,
        category: seed?.category ?? "skin",
        active: true,
        last_done_at: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,protocol_key" },
    )

  if (error) return { ok: false, error: error.message }
  revalidatePath("/creator/dashboard/brand")
  return { ok: true }
}

export async function saveDeal(formData: FormData): Promise<BrandActionResult> {
  const { supabase, userId } = await requireCreatorUser()

  const title = optionalText(formData.get("title"))
  if (!title) return { ok: false, error: "A deal needs a name." }

  const id = optionalText(formData.get("id"))
  const payload = {
    user_id: userId,
    title,
    provider: optionalText(formData.get("provider")),
    url: optionalText(formData.get("url")),
    source: optionalText(formData.get("source")),
    price: optionalNumber(formData.get("price")),
    normal_price: optionalNumber(formData.get("normal_price")),
    protocol_key: optionalText(formData.get("protocol_key")),
    expires_on: optionalText(formData.get("expires_on")),
    state: optionalText(formData.get("state")) ?? "saved",
    updated_at: new Date().toISOString(),
  }

  const query = id
    ? supabase.schema("creator").from("creator_brand_deals").update(payload).eq("id", id).eq("user_id", userId)
    : supabase.schema("creator").from("creator_brand_deals").insert(payload)

  const { error } = await query
  if (error) return { ok: false, error: error.message }
  revalidatePath("/creator/dashboard/brand")
  return { ok: true }
}

export async function setDealState(id: string, state: string): Promise<BrandActionResult> {
  const { supabase, userId } = await requireCreatorUser()
  const { error } = await supabase
    .schema("creator")
    .from("creator_brand_deals")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)

  if (error) return { ok: false, error: error.message }
  revalidatePath("/creator/dashboard/brand")
  return { ok: true }
}
