import { NextResponse } from "next/server"
import { ensurePersonalOrganization, resolveOrganizationSelection } from "@/lib/organizations"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

async function resolveOrgForUser(userId: string) {
  return (
    (await resolveOrganizationSelection(userId, { useCookieOrganization: true })) ??
    (await ensurePersonalOrganization(userId))
  )
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ authenticated: false, sessions: [] })
    }

    const { data: sessions, error } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at, channel")
      .eq("user_id", user.id)
      .eq("channel", "careeros")
      .order("updated_at", { ascending: false })
      .limit(30)

    if (error) throw error

    return NextResponse.json({ authenticated: true, sessions: sessions ?? [] })
  } catch (error) {
    console.error("[careeros/chat/sessions GET]", error)
    return NextResponse.json({ authenticated: false, sessions: [] })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => ({}))) as { title?: string }
    const title =
      typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Career chat"

    const organization = await resolveOrgForUser(user.id)
    if (!organization) {
      return NextResponse.json(
        { error: "Could not resolve workspace for chat history." },
        { status: 400 },
      )
    }

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        organization_id: organization.id,
        title,
        channel: "careeros",
      })
      .select("id, title, created_at, updated_at, channel")
      .single()

    if (error) throw error

    return NextResponse.json({ session })
  } catch (error) {
    console.error("[careeros/chat/sessions POST]", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}
