import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { planVisualsForDraft } from "@/lib/creator/visuals/plan"

export const runtime = "nodejs"
// Inline: the creator asked for it and is looking at the card.
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { work_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  if (!body.work_id) return NextResponse.json({ error: "No draft given" }, { status: 400 })

  const result = await planVisualsForDraft(supabase, user.id, body.work_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ shots: result.shots, captures: result.captures })
}
