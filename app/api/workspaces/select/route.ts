import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ACTIVE_WORKSPACE_COOKIE,
  getWorkspaceRecordByIdForOwner,
} from "@/lib/workspaces"

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { workspaceId?: string | null }
    const workspaceId = body.workspaceId?.trim() || null

    if (!workspaceId) {
      const response = NextResponse.json({ activeWorkspaceId: null, workspace: null })
      response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 })
      return response
    }

    const workspace = await getWorkspaceRecordByIdForOwner(user.id, workspaceId)
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const response = NextResponse.json({
      activeWorkspaceId: workspace.id,
      workspace,
    })
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, COOKIE_OPTIONS)
    return response
  } catch (error) {
    console.error("[workspaces/select] POST:", error)
    return NextResponse.json({ error: "Failed to select workspace" }, { status: 500 })
  }
}
