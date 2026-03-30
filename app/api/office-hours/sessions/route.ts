import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { jsonApiError } from "@/lib/api-error-response"

// GET /api/office-hours/sessions — list user's office-hours sessions with completion status
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ authenticated: false, sessions: [] })

  const { data: sessions, error } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at, channel")
    .eq("user_id", user.id)
    .eq("channel", "office-hours")
    .order("updated_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("[office-hours/sessions GET]", error.message)
    return NextResponse.json({ authenticated: true, sessions: [] })
  }

  // Join design docs to show completion status
  const sessionIds = (sessions ?? []).map((s) => s.id)
  let docsBySession: Record<string, { id: string; mode: string; status: string }> = {}

  if (sessionIds.length > 0) {
    const { data: docs } = await supabase
      .from("design_docs")
      .select("id, session_id, mode, status")
      .eq("user_id", user.id)
      .in("session_id", sessionIds)

    for (const doc of docs ?? []) {
      if (doc.session_id) docsBySession[doc.session_id] = doc
    }
  }

  const enriched = (sessions ?? []).map((s) => ({
    ...s,
    designDoc: docsBySession[s.id] ?? null,
  }))

  return NextResponse.json({ authenticated: true, sessions: enriched })
}

// POST /api/office-hours/sessions — create a new office-hours session
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { mode?: string }
    const mode = body.mode === "builder" ? "builder" : "startup"
    const title = `${mode === "startup" ? "Startup" : "Builder"} Office Hours — ${new Date().toLocaleDateString()}`

    // Use the user session client (RLS), not service role — avoids hard failure when SUPABASE_SERVICE_ROLE_KEY is unset.
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title, channel: "office-hours" })
      .select("id, title, created_at, updated_at, channel")
      .single()

    if (error || !session) {
      console.error("[office-hours/sessions POST]", error?.code, error?.message)
      const channelViolation =
        error?.code === "23514" ||
        (typeof error?.message === "string" &&
          (error.message.includes("chat_sessions_channel_check") ||
            error.message.includes("violates check constraint")))
      const missingChannelColumn =
        typeof error?.message === "string" &&
        error.message.includes("channel") &&
        error.message.includes("does not exist")
      return NextResponse.json(
        {
          error: "Failed to create session",
          details: error?.message ?? "No row returned",
          code: error?.code,
          hint:
            missingChannelColumn || channelViolation
              ? "Run migration 032 or 033 in Supabase SQL editor: supabase/migrations/033_office_hours_complete.sql"
              : undefined,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ session, mode })
  } catch (e: unknown) {
    return jsonApiError(500, e, "office-hours/sessions POST")
  }
}
