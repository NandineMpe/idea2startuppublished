import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/chat/sessions — list user's chat sessions (newest first)
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ sessions: [] })
    }

    const { data: sessions, error } = await supabase
      .from("chat_sessions")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20)

    if (error) throw error

    return NextResponse.json({ sessions: sessions || [] })
  } catch (error) {
    console.error("Error fetching chat sessions:", error)
    return NextResponse.json({ sessions: [] })
  }
}

// POST /api/chat/sessions — create a new chat session
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ session: null })
    }

    const { title } = await req.json().catch(() => ({ title: "New conversation" }))

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.id, title: title || "New conversation" })
      .select("id, title, created_at, updated_at")
      .single()

    if (error) throw error

    return NextResponse.json({ session })
  } catch (error) {
    console.error("Error creating chat session:", error)
    return NextResponse.json({ session: null }, { status: 500 })
  }
}

// GET /api/chat/sessions/[id]/messages would be in a separate file,
// but we keep it simple and include it here via a messages sub-resource below
