import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createTeamOrganization,
  ensurePersonalOrganization,
  listOrganizationsForUser,
  resolveOrganizationSelection,
} from "@/lib/organizations"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ authenticated: false, organizations: [], activeOrganizationId: null })
    }

    await ensurePersonalOrganization(user.id)
    const organizations = await listOrganizationsForUser(user.id)
    const active = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })

    return NextResponse.json({
      authenticated: true,
      organizations,
      activeOrganizationId: active?.id ?? null,
    })
  } catch (error) {
    console.error("[organizations GET]", error)
    return NextResponse.json({ authenticated: false, organizations: [] }, { status: 500 })
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

    const body = (await request.json().catch(() => ({}))) as { displayName?: string }
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""

    if (!displayName) {
      return NextResponse.json({ error: "displayName is required" }, { status: 400 })
    }

    const organization = await createTeamOrganization(user.id, displayName)

    return NextResponse.json({ organization })
  } catch (error) {
    console.error("[organizations POST]", error)
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 })
  }
}
