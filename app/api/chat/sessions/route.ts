import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveOrganizationSelection } from "@/lib/organizations"

type Channel = "sidekick" | "context"

function parseChannel(searchParams: URLSearchParams): Channel | null {
  const c = searchParams.get("channel")
  if (c === "context" || c === "sidekick") return c
  return null
}

// GET /api/chat/sessions — list user's chat sessions (newest first)
// Query: ?channel=sidekick | ?channel=context — omit to list all channels
// Response includes `authenticated` so the client can show accurate empty states.
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ authenticated: false, sessions: [] })
    }

    const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
    if (!organization) {
      return NextResponse.json({ authenticated: true, sessions: [] })
    }

    const channel = parseChannel(new URL(req.url).searchParams)
    let q = supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at, channel")
      .eq("organization_id", organization.id)
    if (channel) {
      q = q.eq("channel", channel)
    }
    const { data: sessions, error } = await q.order("updated_at", { ascending: false }).limit(30)

    if (error) throw error

    return NextResponse.json({ authenticated: true, sessions: sessions || [] })
  } catch (error) {
    console.error("Error fetching chat sessions:", error)
    return NextResponse.json({ authenticated: false, sessions: [] })
  }
}

// POST /api/chat/sessions — create a new chat session
// Body: { title?: string, channel?: "sidekick" | "context" }
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ session: null, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as {
      title?: string
      channel?: string
    }
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New conversation"
    const channel: Channel =
      body.channel === "context" ? "context" : "sidekick"

    const organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
    if (!organization) {
      return NextResponse.json(
        {
          session: null,
          error:
            "No workspace organization found. Open the dashboard to finish setup, then try again.",
        },
        { status: 400 },
      )
    }

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        organization_id: organization.id,
        title,
        channel,
      })
      .select("id, title, created_at, updated_at, channel")
      .single()

    if (error) throw error

    return NextResponse.json({ session })
  } catch (error) {
    console.error("Error creating chat session:", error)
    return NextResponse.json({ session: null, error: "Failed to create session" }, { status: 500 })
  }
}

// GET /api/chat/sessions/[id]/messages would be in a separate file,
// but we keep it simple and include it here via a messages sub-resource below
