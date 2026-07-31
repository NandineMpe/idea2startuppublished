import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { strategiseTrajectory } from "@/lib/creator/trajectory/strategise"

export const runtime = "nodejs"
// Inline rather than queued: the creator has just written down where they are
// going and is waiting to see what the desk makes of it.
export const maxDuration = 300

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const result = await strategiseTrajectory(supabase, user.id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({
    gaps: result.gaps,
    phases: result.phases,
    territory: result.territory,
  })
}
