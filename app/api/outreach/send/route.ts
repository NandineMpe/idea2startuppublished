import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendOutreachEmailForUser } from "@/lib/juno/outreach-send-ops"

export const maxDuration = 60

async function resolveUserId(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId: user.id, supabase }
}

/**
 * POST /api/outreach/send — body: { id: outreach_log uuid }
 * Same behavior as POST /api/outreach/[id] with `{ "action": "send" }`.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  let body: { id?: string }
  try {
    body = (await req.json()) as { id?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const id = typeof body.id === "string" ? body.id.trim() : ""
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 })
  }

  const result = await sendOutreachEmailForUser(auth.supabase, auth.userId, id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, messageId: result.messageId })
}
