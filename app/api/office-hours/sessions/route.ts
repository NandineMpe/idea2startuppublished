import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { jsonApiError } from "@/lib/api-error-response"

function missingModeColumn(msg: string | undefined): boolean {
  const m = (msg ?? "").toLowerCase()
  return m.includes("mode") && (m.includes("does not exist") || m.includes("schema cache"))
}

// GET /api/office-hours/sessions — list user's office-hours sessions with completion status
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ authenticated: false, sessions: [] })

  let first = await supabase
    .from("chat_sessions")
    .select("id, title, mode, created_at, updated_at, channel")
    .eq("user_id", user.id)
    .eq("channel", "office-hours")
    .order("updated_at", { ascending: false })
    .limit(20)

  if (first.error && missingModeColumn(first.error.message)) {
    first = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at, channel")
      .eq("user_id", user.id)
      .eq("channel", "office-hours")
      .order("updated_at", { ascending: false })
      .limit(20)
  }

  const { data: sessions, error } = first

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
    let result = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title, channel: "office-hours", mode })
      .select("id, title, mode, created_at, updated_at, channel")
      .single()

    if (result.error && missingModeColumn(result.error.message)) {
      result = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title, channel: "office-hours" })
        .select("id, title, created_at, updated_at, channel")
        .single()
    }

    const { data: session, error } = result

    if (error || !session) {
      console.error("[office-hours/sessions POST]", error?.code, error?.message)
      const channelViolation =
        error?.code === "23514" ||
        (typeof error?.message === "string" &&
          (error.message.includes("chat_sessions_channel_check") ||
            error.message.includes("violates check constraint")))
      const missingColumn =
        typeof error?.message === "string" &&
        error.message.includes("does not exist") &&
        (error.message.includes("column") || error.message.includes("schema cache"))
      return NextResponse.json(
        {
          error: "Failed to create session",
          details: error?.message ?? "No row returned",
          code: error?.code,
          hint:
            missingColumn || channelViolation
              ? "Run supabase/migrations/034_office_hours_live.sql in the Supabase SQL editor (unblocks channel office-hours). If you use db:migrate, run 035_design_docs_office_hours_rls.sql too for design_docs."
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
