import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createWorkspaceForOwner,
  listWorkspacesForOwner,
  resolveWorkspaceSelection,
} from "@/lib/workspaces"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [workspaces, activeWorkspace] = await Promise.all([
      listWorkspacesForOwner(user.id),
      resolveWorkspaceSelection(user.id),
    ])

    return NextResponse.json({ workspaces, activeWorkspaceId: activeWorkspace?.id ?? null })
  } catch (error) {
    console.error("[workspaces] GET:", error)
    return NextResponse.json({ error: "Failed to load workspaces" }, { status: 500 })
  }
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

    const body = (await request.json().catch(() => ({}))) as {
      displayName?: string
      contactName?: string
      contactEmail?: string
    }

    const displayName = body.displayName?.trim()
    if (!displayName) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 })
    }

    const workspace = await createWorkspaceForOwner({
      ownerUserId: user.id,
      displayName,
      contactName: body.contactName ?? null,
      contactEmail: body.contactEmail ?? null,
    })

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error) {
    console.error("[workspaces] POST:", error)
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 })
  }
}
