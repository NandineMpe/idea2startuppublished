import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { toLegacyFeedRow, type AiOutputDbRow } from "@/lib/ai-outputs-legacy"

const OUT_FIELDS = "id, tool, title, inputs, output, metadata, created_at"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Latest daily brief
    const { data: briefRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .eq("tool", "daily_brief")
      .order("created_at", { ascending: false })
      .limit(1)

    // Latest leads (CRO job pipeline)
    const { data: leadRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .eq("tool", "lead_discovered")
      .order("created_at", { ascending: false })
      .limit(15)

    // Content queue — pending approval + drafts
    const { data: contentRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .in("tool", ["content_linkedin", "content_technical"])
      .order("created_at", { ascending: false })
      .limit(30)

    // Latest tech radar
    const { data: radarRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .eq("tool", "tech_radar")
      .order("created_at", { ascending: false })
      .limit(1)

    // Latest staff meeting synthesis (agent collaboration)
    const { data: staffMeetingRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .eq("tool", "staff_meeting")
      .order("created_at", { ascending: false })
      .limit(1)

    // Pipeline status — last run per type
    const pipelineStatus: Record<string, string | null> = {
      cbs: null,
      cro: null,
      cmo: null,
      cto: null,
    }

    if (briefRows?.[0]) pipelineStatus.cbs = briefRows[0].created_at
    if (leadRows?.[0]) pipelineStatus.cro = leadRows[0].created_at

    const contentRowsNorm = (contentRows ?? []).map((r) => toLegacyFeedRow(r as AiOutputDbRow))

    const latestLinkedinPost =
      contentRowsNorm.find(
        (r) =>
          r.type === "content_linkedin" &&
          (r.content as { contentType?: string } | undefined)?.contentType === "post",
      ) ??
      contentRowsNorm.find(
        (r) =>
          r.type === "content_linkedin" &&
          (r.content as { contentType?: string } | undefined)?.contentType !== "comment",
      )
    if (latestLinkedinPost) pipelineStatus.cmo = latestLinkedinPost.created_at

    if (radarRows?.[0]) pipelineStatus.cto = radarRows[0].created_at

    // Filter content queue: only pending_approval and draft
    const contentQueue = contentRowsNorm.filter((r) => {
      const status = r.content?.status
      return status === "pending_approval" || status === "draft"
    })

    const commentDraftCount = contentRowsNorm.filter((r) => {
      const c = r.content as { contentType?: string; status?: string } | undefined
      return (
        c?.contentType === "comment" &&
        (c.status === "pending_approval" || c.status === "draft")
      )
    }).length

    return NextResponse.json({
      brief: briefRows?.[0] ? toLegacyFeedRow(briefRows[0] as AiOutputDbRow) : null,
      leads: (leadRows ?? []).map((r) => toLegacyFeedRow(r as AiOutputDbRow)),
      contentQueue,
      radar: radarRows?.[0] ? toLegacyFeedRow(radarRows[0] as AiOutputDbRow) : null,
      pipelineStatus,
      staffMeeting: staffMeetingRows?.[0]
        ? toLegacyFeedRow(staffMeetingRows[0] as AiOutputDbRow)
        : null,
      commentDraftCount,
    })
  } catch (err) {
    console.error("Intelligence feed error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
