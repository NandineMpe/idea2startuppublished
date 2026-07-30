import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import {
  listWorkflowsForCaller,
  triggerCareerOSWorkflows,
} from "@/lib/careeros/inngest/trigger-workflows"
import type { CareerOSWorkflowKey } from "@/lib/careeros/inngest/workflow-catalog"
import { isCareerOSWorkflowAdmin } from "@/lib/careeros/workflows-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Ops: run any CareerOS ingest / market workflow on demand.
 * Auth: ?token=VERIFY_TOKEN or Authorization: Bearer VERIFY_TOKEN|CRON_SECRET
 *
 * POST body: { "workflow": "preset:ingest-full" | "careeros/feed.ingest", "userId"?: "uuid", "data"?: {} }
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") return NextResponse.json({ error: "Not found" }, { status: 404 })

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    return NextResponse.json({ error: "INNGEST_EVENT_KEY not set" }, { status: 501 })
  }

  return NextResponse.json({
    ok: true,
    mode: "admin",
    workflows: listWorkflowsForCaller(true),
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  try {
    const { verify } = await context.params
    if (verify !== "_verify") return NextResponse.json({ error: "Not found" }, { status: 404 })

    const url = new URL(request.url)
    const token = url.searchParams.get("token")
    const tokenOk = token && token === process.env.VERIFY_TOKEN
    if (!tokenOk && !isCareerOSWorkflowAdmin(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!process.env.INNGEST_EVENT_KEY?.trim()) {
      return NextResponse.json({ error: "INNGEST_EVENT_KEY not set" }, { status: 501 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      workflow?: string
      userId?: string
      data?: Record<string, unknown>
    }
    const workflow = body.workflow?.trim()
    if (!workflow) {
      return NextResponse.json({ error: "workflow is required" }, { status: 400 })
    }

    const result = await triggerCareerOSWorkflows({
      workflow: workflow as CareerOSWorkflowKey,
      userId: body.userId?.trim() || undefined,
      data: body.data,
      admin: true,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e: unknown) {
    return jsonApiError(500, e, "careeros/[verify]/workflows/run POST")
  }
}
