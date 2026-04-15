import { NextResponse } from "next/server"
import {
  ACTIVE_ORGANIZATION_COOKIE,
  listOrganizationsForUser,
} from "@/lib/organizations"
import { createClient } from "@/lib/supabase/server"
import {
  ACTIVE_WORKSPACE_COOKIE,
  getWorkspaceRecordBySlugForOwner,
  isValidWorkspaceSlug,
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

    const body = (await request.json().catch(() => ({}))) as { slug?: string | null }
    const slug = body.slug?.trim().toLowerCase() ?? ""

    if (!slug || !isValidWorkspaceSlug(slug)) {
      return NextResponse.json(
        {
          error:
            "Slug must be 3-50 chars, lowercase letters and numbers with optional hyphens.",
        },
        { status: 400 },
      )
    }

    const organizations = await listOrganizationsForUser(user.id)
    const organizationMatch = organizations.find((organization) => organization.slug === slug) ?? null

    if (organizationMatch) {
      const response = NextResponse.json({
        scope: "organization",
        organization: organizationMatch,
        workspace: null,
      })
      response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationMatch.id, COOKIE_OPTIONS)
      response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 })
      return response
    }

    const workspace = await getWorkspaceRecordBySlugForOwner(user.id, slug)
    if (!workspace) {
      return NextResponse.json({ error: "Slug not found in your organizations or workspaces." }, { status: 404 })
    }

    const response = NextResponse.json({
      scope: "workspace",
      organizationId: workspace.organizationId,
      workspace,
    })

    if (workspace.organizationId) {
      const canAccessOrg = organizations.some((organization) => organization.id === workspace.organizationId)
      if (!canAccessOrg) {
        return NextResponse.json({ error: "Workspace organization access denied." }, { status: 403 })
      }
      response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, workspace.organizationId, COOKIE_OPTIONS)
    }

    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, COOKIE_OPTIONS)
    return response
  } catch (error) {
    console.error("[workspaces/select-slug] POST:", error)
    return NextResponse.json({ error: "Failed to select slug scope" }, { status: 500 })
  }
}

