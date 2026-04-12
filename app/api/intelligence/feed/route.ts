import { NextResponse } from "next/server"
import { coerceBehavioralSummary } from "@/lib/juno/reddit-recon"
import { createClient } from "@/lib/supabase/server"
import { toLegacyFeedRow, type AiOutputDbRow } from "@/lib/ai-outputs-legacy"
import { resolveWorkspaceSelection } from "@/lib/workspaces"
import { supabaseAdmin } from "@/lib/supabase"

const OUT_FIELDS = "id, tool, title, inputs, output, metadata, created_at"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // ── Workspace mode: return workspace profile context instead of owner ai_outputs ──
    const activeWorkspace = await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })
    if (activeWorkspace) {
      const { data: wsProfile } = await supabaseAdmin
        .from("client_workspace_profiles")
        .select("company_name, company_description, problem, solution, target_market, traction, knowledge_base_md, founder_name, stage, icp, competitors, priorities, risks, keywords")
        .eq("workspace_id", activeWorkspace.id)
        .maybeSingle()

      // Return a workspace-scoped response — no owner ai_outputs
      return NextResponse.json({
        workspaceScope: true,
        workspaceId: activeWorkspace.id,
        workspaceName: activeWorkspace.displayName,
        workspaceProfile: wsProfile ?? null,
        brief: null,
        leads: [],
        behavioralUpdates: null,
        contentQueue: [],
        radar: null,
        pipelineStatus: {},
        staffMeeting: null,
        commentDraftCount: 0,
        hotIntentCount: 0,
      })
    }

    // Latest daily brief (includes seeded market briefs)
    const { data: briefRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .in("tool", ["daily_brief", "competitor-snapshot"])
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

    // Latest behavioral customer research snapshot
    const { data: behavioralRows } = await supabase
      .from("ai_outputs")
      .select(OUT_FIELDS)
      .eq("user_id", user.id)
      .eq("tool", "behavioral_updates")
      .order("created_at", { ascending: false })
      .limit(1)

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

    const { data: latestIntentRows } = await supabase
      .from("intent_signals")
      .select("discovered_at")
      .eq("user_id", user.id)
      .eq("platform", "reddit")
      .order("discovered_at", { ascending: false })
      .limit(1)

    const { count: hotIntentCount } = await supabase
      .from("intent_signals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("platform", "reddit")
      .eq("status", "new")
      .gte("relevance_score", 8)

    // Pipeline status - last run per type
    const pipelineStatus: Record<string, string | null> = {
      cbs: null,
      cro: null,
      cmo: null,
      cto: null,
      intent: null,
    }

    if (briefRows?.[0]) pipelineStatus.cbs = briefRows[0].created_at
    if (leadRows?.[0]) pipelineStatus.cro = leadRows[0].created_at
    if (behavioralRows?.[0]) {
      pipelineStatus.intent = behavioralRows[0].created_at
    } else if (latestIntentRows?.[0]) {
      pipelineStatus.intent = latestIntentRows[0].discovered_at
    }

    const contentRowsNorm = (contentRows ?? []).map((r) => toLegacyFeedRow(r as AiOutputDbRow))
    const behavioralInputs = (behavioralRows?.[0]?.inputs ?? {}) as Record<string, unknown>
    const behavioralSummary = coerceBehavioralSummary(behavioralInputs.summary)
    const behavioralMeta = behavioralInputs

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
      behavioralUpdates:
        behavioralRows?.[0] && behavioralSummary
          ? {
              id: behavioralRows[0].id,
              created_at: behavioralRows[0].created_at,
              summary: behavioralSummary,
              conversationCount:
                typeof behavioralMeta.conversationCount === "number"
                  ? behavioralMeta.conversationCount
                  : Number(behavioralMeta.conversationCount ?? 0) || 0,
              subreddits: Array.isArray(behavioralMeta.subreddits)
                ? behavioralMeta.subreddits.filter(
                    (value): value is string => typeof value === "string" && value.trim().length > 0,
                  )
                : [],
              latestSignalAt:
                typeof behavioralMeta.latestSignalAt === "string" ? behavioralMeta.latestSignalAt : null,
            }
          : null,
      contentQueue,
      radar: radarRows?.[0] ? toLegacyFeedRow(radarRows[0] as AiOutputDbRow) : null,
      pipelineStatus,
      staffMeeting: staffMeetingRows?.[0]
        ? toLegacyFeedRow(staffMeetingRows[0] as AiOutputDbRow)
        : null,
      commentDraftCount,
      hotIntentCount: hotIntentCount ?? 0,
    })
  } catch (err) {
    console.error("Intelligence feed error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
