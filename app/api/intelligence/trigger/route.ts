import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"

const PIPELINE_EVENTS: Record<string, string> = {
  cbs: "juno/brief.requested",
  cro: "juno/jobs.scan.requested",
  intent: "juno/intent.scan.requested",
}

export async function POST(req: Request) {
  try {
    if (!process.env.INNGEST_EVENT_KEY) {
      return NextResponse.json(
        { error: "INNGEST_EVENT_KEY is not set, so manual scan triggers are unavailable right now." },
        { status: 501 },
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { pipeline } = await req.json() as { pipeline: string }
    const eventName = PIPELINE_EVENTS[pipeline]
    if (!eventName) {
      return NextResponse.json({ error: `Unknown pipeline: ${pipeline}` }, { status: 400 })
    }

    // Check company profile exists — brief will be skipped if not
    if (pipeline === "cbs") {
      const { data: profile } = await supabase
        .from("company_profile")
        .select("company_name")
        .eq("user_id", user.id)
        .single()

      if (!profile?.company_name) {
        return NextResponse.json(
          { error: "No company profile found. Fill in My Context → Company & Founder first." },
          { status: 422 },
        )
      }
    }

    if (pipeline === "intent") {
      const { data: profile } = await supabase
        .from("company_profile")
        .select("company_name")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!profile?.company_name?.trim()) {
        return NextResponse.json(
          { error: "Add your company profile under Context before running this scan." },
          { status: 422 },
        )
      }
    }

    await inngest.send({
      name: eventName as
        | "juno/brief.requested"
        | "juno/jobs.scan.requested"
        | "juno/intent.scan.requested",
      data: { userId: user.id },
    })

    return NextResponse.json({ ok: true, pipeline, event: eventName })
  } catch (err) {
    console.error("Trigger error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
