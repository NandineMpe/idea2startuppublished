import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/office-hours/design-doc?sessionId=... — get design doc for a session
// GET /api/office-hours/design-doc?all=true — list all design docs for the user
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(req.url)
  const sessionId = url.searchParams.get("sessionId")
  const all = url.searchParams.get("all") === "true"

  if (all) {
    const { data, error } = await supabase
      .from("design_docs")
      .select("id, session_id, mode, title, doc_data, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    if (error) {
      const msg = (error.message ?? "").toLowerCase()
      if (msg.includes("does not exist") || msg.includes("schema cache")) {
        return NextResponse.json({ docs: [] })
      }
      console.error("[design-doc GET all]", error.message)
      return NextResponse.json({ error: "Failed to load design docs" }, { status: 500 })
    }
    return NextResponse.json({ docs: data ?? [] })
  }

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("design_docs")
    .select("id, session_id, mode, title, doc_data, status, created_at")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .maybeSingle()

  if (error) {
    console.error("[design-doc GET]", error.message)
    return NextResponse.json({ error: "Failed to load design doc" }, { status: 500 })
  }

  return NextResponse.json({ doc: data ?? null })
}

// PATCH /api/office-hours/design-doc — update status (draft → approved)
export async function PATCH(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { id: string; status: "draft" | "approved" }
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await supabase
    .from("design_docs")
    .update({ status: body.status ?? "approved" })
    .eq("id", body.id)
    .eq("user_id", user.id)

  if (error) {
    console.error("[design-doc PATCH]", error.message)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
