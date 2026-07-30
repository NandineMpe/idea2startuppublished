import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { suggestMovesForUser } from "@/lib/creator/opportunities/moves"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const result = await suggestMovesForUser(supabase, user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ proposed: result.proposed })
}
