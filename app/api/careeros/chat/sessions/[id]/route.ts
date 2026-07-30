import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ messages: [] }, { status: 401 })
    }

    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("channel", "careeros")
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ messages: [] }, { status: 404 })
    }

    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json({ messages: messages ?? [] })
  } catch (error) {
    console.error("[careeros/chat/sessions/[id] GET]", error)
    return NextResponse.json({ messages: [] }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const { error } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("channel", "careeros")

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[careeros/chat/sessions/[id] DELETE]", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
