import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getWorkspaceRecordByShareToken } from "@/lib/workspaces"

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const workspace = await getWorkspaceRecordByShareToken(token)

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: profile } = await supabaseAdmin
    .from("client_workspace_profiles")
    .select(
      "company_name, company_description, tagline, problem, solution, target_market, industry, stage, traction, founder_name, thesis, icp, competitors, differentiators, priorities, risks",
    )
    .eq("workspace_id", workspace.id)
    .maybeSingle()

  return NextResponse.json({
    workspace: {
      displayName: workspace.displayName,
      companyName: workspace.companyName,
      contactName: workspace.contactName,
      contextStatus: workspace.contextStatus,
    },
    profile: profile ?? null,
  })
}
