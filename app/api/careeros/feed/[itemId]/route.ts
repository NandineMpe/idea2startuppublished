import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { action?: string }
  const action = String(body.action ?? "")
  if (action !== "save" && action !== "dismiss") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  }
  const { data: existing, error: loadError } = await supabaseAdmin
    .schema("careeros")
    .from("user_ai_feed_items")
    .select("item_payload")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle()
  if (loadError) throw loadError

  const now = new Date().toISOString()
  const payload =
    existing?.item_payload && typeof existing.item_payload === "object"
      ? (existing.item_payload as Record<string, unknown>)
      : {}
  const patch =
    action === "dismiss"
      ? {
          is_read: true,
          read_at: now,
          dismissed_at: now,
          item_payload: {
            ...payload,
            dismissed: true,
            dismissed_at: now,
            opened_at: payload.opened_at ?? now,
          },
        }
      : {
          is_read: true,
          read_at: now,
          item_payload: {
            ...payload,
            saved: true,
            saved_at: now,
            opened_at: payload.opened_at ?? now,
          },
        }
  const { error } = await supabaseAdmin
    .schema("careeros")
    .from("user_ai_feed_items")
    .update(patch)
    .eq("id", itemId)
    .eq("user_id", user.id)
  if (error) throw error
  return NextResponse.json({ ok: true })
}
