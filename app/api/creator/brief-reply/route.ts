import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { draftBriefReply } from "@/lib/creator/deals/brief-reply"

export const runtime = "nodejs"
// The creator is waiting on this one, so it runs inline rather than queueing
// through Inngest — but a reasoning pass over a long brief needs the headroom.
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { email?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const result = await draftBriefReply(supabase, user.id, body.email ?? "")
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ reply: result.reply })
}
