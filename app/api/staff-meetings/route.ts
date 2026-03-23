import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** List staff meeting syntheses (newest first) for history tabs / date filter. */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("ai_outputs")
      .select("id, content, metadata, created_at")
      .eq("user_id", user.id)
      .eq("type", "staff_meeting")
      .order("created_at", { ascending: false })
      .limit(60)

    if (error) {
      console.error("staff-meetings list:", error.message)
      return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 })
    }

    return NextResponse.json({ meetings: data ?? [] })
  } catch (err) {
    console.error("staff-meetings:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
