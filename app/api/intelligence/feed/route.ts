import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Latest daily brief
    const { data: briefRows } = await supabase
      .from("ai_outputs")
      .select("id, type, content, metadata, created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_brief")
      .order("created_at", { ascending: false })
      .limit(1)

    // Latest leads (last 7 days)
    const { data: leadRows } = await supabase
      .from("ai_outputs")
      .select("id, type, content, metadata, created_at")
      .eq("user_id", user.id)
      .eq("type", "lead_discovered")
      .order("created_at", { ascending: false })
      .limit(15)

    // Content queue — pending approval + drafts
    const { data: contentRows } = await supabase
      .from("ai_outputs")
      .select("id, type, content, metadata, created_at")
      .eq("user_id", user.id)
      .in("type", ["content_linkedin", "content_technical"])
      .order("created_at", { ascending: false })
      .limit(30)

    // Latest tech radar
    const { data: radarRows } = await supabase
      .from("ai_outputs")
      .select("id, type, content, metadata, created_at")
      .eq("user_id", user.id)
      .eq("type", "tech_radar")
      .order("created_at", { ascending: false })
      .limit(1)

    // Pipeline status — last run per type
    const typeMap: Record<string, string> = {
      daily_brief: "cbs",
      lead_discovered: "cro",
      content_linkedin: "cmo",
      tech_radar: "cto",
    }

    const pipelineStatus: Record<string, string | null> = {
      cbs: null,
      cro: null,
      cmo: null,
      cto: null,
    }

    if (briefRows?.[0]) pipelineStatus.cbs = briefRows[0].created_at
    if (leadRows?.[0]) pipelineStatus.cro = leadRows[0].created_at
    const latestContent = contentRows?.find((r) => r.type === "content_linkedin")
    if (latestContent) pipelineStatus.cmo = latestContent.created_at
    if (radarRows?.[0]) pipelineStatus.cto = radarRows[0].created_at

    // Filter content queue: only pending_approval and draft
    const contentQueue = (contentRows ?? []).filter((r) => {
      const status = r.content?.status
      return status === "pending_approval" || status === "draft"
    })

    return NextResponse.json({
      brief: briefRows?.[0] ?? null,
      leads: leadRows ?? [],
      contentQueue,
      radar: radarRows?.[0] ?? null,
      pipelineStatus,
    })
  } catch (err) {
    console.error("Intelligence feed error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
