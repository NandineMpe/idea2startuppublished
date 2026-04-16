import { NextResponse } from "next/server"
import { jsonApiError, logApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { inngest } from "@/lib/inngest/client"
import { resolveOrganizationSelection } from "@/lib/organizations"

const PIPELINE_EVENTS: Record<string, string> = {
  cbs: "juno/brief.requested",
  cro: "juno/jobs.scan.requested",
  intent: "juno/intent.scan.requested",
  cto: "juno/tech.radar.requested",
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { pipeline?: string }
    const pipeline = typeof body.pipeline === "string" ? body.pipeline : ""
    const eventName = PIPELINE_EVENTS[pipeline]
    if (!eventName) {
      return NextResponse.json({ error: `Unknown pipeline: ${pipeline}` }, { status: 400 })
    }

    let organization
    try {
      organization = await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
    } catch (orgErr) {
      logApiError("intelligence trigger resolveOrganization", orgErr)
      return NextResponse.json(
        {
          error:
            "Could not load your workspace. Check that SUPABASE_SERVICE_ROLE_KEY is set on the server and try again.",
        },
        { status: 503 },
      )
    }

    // Check company profile exists so manual runs have usable context.
    if (pipeline === "cbs" || pipeline === "intent" || pipeline === "cto") {
      const { data: profile } = organization
        ? await supabase
            .from("company_profile")
            .select("company_name")
            .eq("organization_id", organization.id)
            .maybeSingle()
        : { data: null }

      if (!profile?.company_name?.trim()) {
        const message =
          pipeline === "intent"
            ? "Add your company profile under Context before running this scan."
            : pipeline === "cto"
              ? "Add your company profile under Context before running Tech radar."
              : "No company profile found. Fill in My Context -> Company & Founder first."

        return NextResponse.json({ error: message }, { status: 422 })
      }
    }

    try {
      await inngest.send({
        name: eventName as
          | "juno/brief.requested"
          | "juno/jobs.scan.requested"
          | "juno/intent.scan.requested"
          | "juno/tech.radar.requested",
        data: { userId: user.id },
      })
    } catch (sendErr) {
      logApiError("intelligence trigger inngest.send", sendErr)
      return NextResponse.json(
        {
          error:
            "Could not queue the job with Inngest. Confirm INNGEST_EVENT_KEY in Vercel matches Inngest Cloud -> Keys (Production).",
        },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true, pipeline, event: eventName })
  } catch (err) {
    return jsonApiError(500, err, "intelligence trigger POST")
  }
}
