import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { draftFollowUp } from "@/lib/creator/deals/follow-up"
import { markSent, setConversationState, type ConversationState } from "@/lib/creator/deals/conversations"

export const runtime = "nodejs"
// Same reasoning as the brief reply: she is waiting on this one, so it runs
// inline rather than queueing, and a reasoning pass over a thread needs headroom.
export const maxDuration = 300

const STATES: ConversationState[] = ["open", "replied", "won", "lost"]

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { conversation_id?: string; action?: string; seq?: number; state?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const id = body.conversation_id
  if (!id) return NextResponse.json({ error: "conversation_id is required" }, { status: 400 })

  // Marking sent is what starts the silence clock, so it is a first-class action
  // rather than something inferred from the draft having been generated.
  if (body.action === "mark_sent") {
    if (typeof body.seq !== "number") {
      return NextResponse.json({ error: "seq is required" }, { status: 400 })
    }
    const ok = await markSent(supabase, user.id, id, body.seq)
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Could not mark that message as sent." }, { status: 400 })
  }

  if (body.action === "set_state") {
    const state = body.state as ConversationState
    if (!STATES.includes(state)) {
      return NextResponse.json({ error: "Unknown state" }, { status: 400 })
    }
    const ok = await setConversationState(supabase, user.id, id, state)
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Could not update that conversation." }, { status: 400 })
  }

  const result = await draftFollowUp(supabase, user.id, id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ draft: result.draft, message: result.message })
}
