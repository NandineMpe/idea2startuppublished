import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { derivePositioningForUser } from "@/lib/creator/canon/positioning"

export const runtime = "nodejs"
// Runs inline rather than queueing: the creator is waiting on the result.
export const maxDuration = 300

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const result = await derivePositioningForUser(supabase, user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ positioning: result.positioning })
}
