import { NextResponse } from "next/server"
import { triggerCareerOSWorkflows } from "@/lib/careeros/inngest/trigger-workflows"
import { isCareerOSWorkflowAdmin } from "@/lib/careeros/workflows-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/** On-demand: queue skill velocity refresh (was Vercel cron). */
export async function GET(request: Request) {
  if (!isCareerOSWorkflowAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    return NextResponse.json({ error: "INNGEST_EVENT_KEY not set" }, { status: 501 })
  }

  const result = await triggerCareerOSWorkflows({
    workflow: "careeros/market.refresh-skill-velocity",
    admin: true,
  })

  return NextResponse.json({
    ok: true,
    mode: "on_demand",
    workflow: "careeros/market.refresh-skill-velocity",
    ...result,
  })
}
