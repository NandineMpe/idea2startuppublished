import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, key)
}

function normalizeWhatsAppAddr(addr: string): string {
  const a = addr.trim()
  if (a.startsWith("whatsapp:")) return a
  return `whatsapp:${a}`
}

// ─── WhatsApp via Twilio ─────────────────────────────────────────

export async function sendWhatsApp(
  to: string | undefined,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM // e.g. whatsapp:+14155238886

  const dest = to?.trim()
  if (!dest) {
    console.log("[WhatsApp] No destination. Message:")
    console.log(body.slice(0, 800))
    return { success: false, error: "no_phone" }
  }

  if (!sid || !token || !from) {
    console.log("[WhatsApp] Twilio not configured. Message:")
    console.log(body.slice(0, 800))
    return { success: false, error: "Twilio not configured" }
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      },
      body: new URLSearchParams({
        From: normalizeWhatsAppAddr(from),
        To: normalizeWhatsAppAddr(dest),
        Body: body.slice(0, 1600),
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return { success: false, error: err }
    }

    const data = (await res.json()) as { sid?: string }
    return { success: true, sid: data.sid }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: msg }
  }
}

/**
 * Load WhatsApp destination from `company_profile` (E.164, verified).
 * Returns null if unset, unverified, or on error.
 */
export async function getUserWhatsAppNumber(userId: string): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return null
  }
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from("company_profile")
      .select("whatsapp_number, whatsapp_verified")
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !data?.whatsapp_number || !data.whatsapp_verified) return null
    return data.whatsapp_number as string
  } catch {
    return null
  }
}

/**
 * Send WhatsApp to a user by `userId` (reads verified number from DB).
 * No-op if not configured.
 */
export async function sendWhatsAppToUser(
  userId: string,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = await getUserWhatsAppNumber(userId)
  if (!phone) {
    console.log(`[WhatsApp] User ${userId} has no verified WhatsApp number — skipping send`)
    return { success: false, error: "no_number" }
  }
  return sendWhatsApp(phone, body)
}

// ─── Persist brief to Supabase ───────────────────────────────────

export async function saveBriefToDB(params: {
  userId: string
  brief: unknown
  rawItemCount: number
  scoredItemCount: number
  briefDateIso?: string
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[juno/delivery] saveBriefToDB: missing Supabase env — skipping")
    return
  }

  try {
    const supabase = getServiceClient()
    const contentPayload =
      typeof params.brief === "object" && params.brief !== null
        ? (params.brief as Record<string, unknown>)
        : { markdown: String(params.brief) }

    const { error } = await supabase.from("ai_outputs").insert({
      user_id: params.userId,
      type: "daily_brief",
      content: contentPayload,
      metadata: {
        raw_items: params.rawItemCount,
        scored_items: params.scoredItemCount,
        generated_at: new Date().toISOString(),
        ...(params.briefDateIso ? { brief_date_iso: params.briefDateIso } : {}),
      },
    })

    if (error) console.error("[juno/delivery] Failed to save brief:", error.message)
  } catch (e) {
    console.error("[juno/delivery] saveBriefToDB:", e instanceof Error ? e.message : e)
  }
}

// ─── Persist leads to Supabase ───────────────────────────────────

export type SaveLeadInput = {
  userId: string
  company: string
  role: string
  url?: string
  score: number
  pitchAngle: string
  source: string
}

export async function saveLeadToDB(params: SaveLeadInput): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[juno/delivery] saveLeadToDB: missing Supabase env — skipping")
    return
  }

  try {
    const supabase = getServiceClient()
    const { error } = await supabase.from("ai_outputs").insert({
      user_id: params.userId,
      type: "lead_discovered",
      content: {
        company: params.company,
        role: params.role,
        url: params.url ?? "",
        score: params.score,
        pitchAngle: params.pitchAngle,
      },
      metadata: { source: params.source, discovered_at: new Date().toISOString() },
    })

    if (error) console.error("[juno/delivery] Failed to save lead:", error.message)
  } catch (e) {
    console.error("[juno/delivery] saveLeadToDB:", e instanceof Error ? e.message : e)
  }
}

// ─── Persist content to Supabase ─────────────────────────────────

export type SaveContentInput = {
  userId: string
  platform: string
  contentType: string
  body: string
  status: "draft" | "pending_approval" | "approved" | "published"
}

export async function saveContentToDB(params: SaveContentInput): Promise<string | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn("[juno/delivery] saveContentToDB: missing Supabase env — skipping")
    return null
  }

  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from("ai_outputs")
      .insert({
        user_id: params.userId,
        type: `content_${params.platform}`,
        content: {
          platform: params.platform,
          contentType: params.contentType,
          body: params.body,
          status: params.status,
        },
        metadata: { created_at: new Date().toISOString() },
      })
      .select("id")
      .single()

    if (error) {
      console.error("[juno/delivery] Failed to save content:", error.message)
      return null
    }
    return data?.id ?? null
  } catch (e) {
    console.error("[juno/delivery] saveContentToDB:", e instanceof Error ? e.message : e)
    return null
  }
}
