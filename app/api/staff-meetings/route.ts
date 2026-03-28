import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { toLegacyFeedRow, type AiOutputDbRow } from "@/lib/ai-outputs-legacy"

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
      .select("id, tool, title, inputs, output, metadata, created_at")
      .eq("user_id", user.id)
      .eq("tool", "staff_meeting")
      .order("created_at", { ascending: false })
      .limit(60)

    if (error) {
      console.error("staff-meetings list:", error.message)
      return NextResponse.json({ error: "Failed to load meetings" }, { status: 500 })
    }

    const meetings = (data ?? []).map((r) => {
      const legacy = toLegacyFeedRow(r as AiOutputDbRow)
      return {
        id: legacy.id,
        content: legacy.content,
        metadata: legacy.metadata,
        created_at: legacy.created_at,
      }
    })

    return NextResponse.json({ meetings })
  } catch (err) {
    console.error("staff-meetings:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
