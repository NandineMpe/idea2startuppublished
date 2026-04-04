import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createOrRefreshInvitation,
  listPendingInvitations,
  revokeInvitation,
} from "@/lib/organization-invites"
import { getMembershipRole } from "@/lib/organizations"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const organizationId = new URL(request.url).searchParams.get("organizationId")?.trim()
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 })
    }

    const role = await getMembershipRole(user.id, organizationId)
    if (!role || (role !== "owner" && role !== "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const invitations = await listPendingInvitations(organizationId)
    return NextResponse.json({ invitations })
  } catch (e) {
    console.error("[invitations GET]", e)
    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 })
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
      organizationId?: string
      email?: string
      role?: "admin" | "member"
    }

    const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
    const email = typeof body.email === "string" ? body.email : ""
    const role = body.role === "admin" ? "admin" : "member"

    if (!organizationId || !email) {
      return NextResponse.json({ error: "organizationId and email are required" }, { status: 400 })
    }

    const result = await createOrRefreshInvitation({
      actorUserId: user.id,
      organizationId,
      emailRaw: email,
      role,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[invitations POST]", e)
    return NextResponse.json({ error: "Failed to send invite" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get("id")?.trim()
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }

    const result = await revokeInvitation({ actorUserId: user.id, invitationId: id })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[invitations DELETE]", e)
    return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 })
  }
}
