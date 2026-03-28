import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("intent_signals")
      .select("*")
      .eq("user_id", user.id)
      .order("discovered_at", { ascending: false })
      .limit(40)

    if (error) {
      console.error("intent-signals GET:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ signals: data ?? [] })
  } catch (e) {
    console.error("intent-signals GET:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
