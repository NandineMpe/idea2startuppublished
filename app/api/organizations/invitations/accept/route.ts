import { NextResponse } from "next/server"
import { acceptInvitationByToken } from "@/lib/organization-invites"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const token = typeof body.token === "string" ? body.token.trim() : ""
    if (!token) {
      return NextResponse.json({ error: "token is required" }, { status: 400 })
    }

    const result = await acceptInvitationByToken({
      userId: user.id,
      userEmail: user.email,
      token,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, organizationId: result.organizationId })
  } catch (e) {
    console.error("[invitations accept]", e)
    return NextResponse.json({ error: "Could not accept invite" }, { status: 500 })
  }
}
