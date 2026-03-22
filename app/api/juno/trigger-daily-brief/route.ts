import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"

/**
 * POST — authenticated user only. Sends `juno/daily-brief.run` for your user.
 * Requires `INNGEST_EVENT_KEY` in env (Inngest Cloud → Keys).
 */
export async function POST() {
  if (!process.env.INNGEST_EVENT_KEY) {
    return NextResponse.json(
      { error: "INNGEST_EVENT_KEY not set — add from Inngest dashboard to send events from the app." },
      { status: 501 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await inngest.send({
    name: "juno/daily-brief.run",
    data: { userId: user.id },
  })

  return NextResponse.json({ ok: true, message: "Daily brief run queued. Check Inngest dashboard." })
}
