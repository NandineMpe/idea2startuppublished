import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ feedback: [] })
    }

    const { data, error } = await supabase
      .from("user_feedback")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ feedback: data || [] })
  } catch (error) {
    console.error("Feedback GET error:", error)
    return NextResponse.json({ feedback: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = await req.json()

    const { data, error } = await supabase
      .from("user_feedback")
      .insert({
        user_id: user?.id ?? null,
        source: body.source ?? null,
        sentiment: body.sentiment ?? "neutral",
        content: body.content ?? "",
        tags: body.tags ?? [],
      })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, item: data })
  } catch (error) {
    console.error("Feedback POST error:", error)
    return NextResponse.json({ success: false, error: "Failed to save feedback" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    const { id } = await req.json()

    const { error } = await supabase
      .from("user_feedback")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Feedback DELETE error:", error)
    return NextResponse.json({ success: false, error: "Failed to delete feedback" }, { status: 500 })
  }
}
