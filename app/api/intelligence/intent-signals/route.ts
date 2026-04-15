import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { resolveWorkspaceSelection } from "@/lib/workspaces"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const workspace = await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })
    if (workspace) {
      return NextResponse.json({
        signals: [],
        workspaceScope: true,
        workspaceName: workspace.displayName ?? workspace.companyName ?? "Client workspace",
      })
    }

    const { searchParams } = new URL(req.url)
    const platform = searchParams.get("platform")?.trim().toLowerCase() || null
    const limitParam = Number(searchParams.get("limit") ?? 40)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 1), 100) : 40

    let query = supabase
      .from("intent_signals")
      .select("*")
      .eq("user_id", user.id)
      .order("discovered_at", { ascending: false })
      .limit(limit)

    if (platform) {
      query = query.eq("platform", platform)
    }

    const { data, error } = await query

    if (error) {
      return jsonApiError(500, error, "intent-signals GET")
    }

    return NextResponse.json({ signals: data ?? [] })
  } catch (e) {
    console.error("intent-signals GET:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
