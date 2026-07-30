import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { expandCreatorSeed } from "@/lib/creator/research/expand"

export const runtime = "nodejs"
// Inline rather than queued: the creator brought the lead and is waiting to
// find out whether it stands up.
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { seed?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const result = await expandCreatorSeed(supabase, user.id, body.seed ?? "")
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ verdict: result.verdict, receipts: result.receipts })
}
