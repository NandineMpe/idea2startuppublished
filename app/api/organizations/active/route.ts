import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  ACTIVE_ORGANIZATION_COOKIE,
  getOrganizationByIdForUser,
} from "@/lib/organizations"
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspaces"

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

    const body = (await request.json().catch(() => ({}))) as { organizationId?: string | null }
    const raw = body.organizationId?.trim() || null

    if (!raw) {
      const response = NextResponse.json({ activeOrganizationId: null, organization: null })
      response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 })
      response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 })
      return response
    }

    const organization = await getOrganizationByIdForUser(user.id, raw)
    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    const response = NextResponse.json({
      activeOrganizationId: organization.id,
      organization,
    })
    response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organization.id, COOKIE_OPTIONS)
    // Organization switch should reset active client workspace selection.
    response.cookies.set(ACTIVE_WORKSPACE_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 })
    return response
  } catch (error) {
    console.error("[organizations/active POST]", error)
    return NextResponse.json({ error: "Failed to set active organization" }, { status: 500 })
  }
}
