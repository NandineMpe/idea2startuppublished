import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { sendCareerOSEvent } from "@/lib/careeros/inngest/client"
import {
  listWorkflowsForCaller,
  triggerCareerOSWorkflows,
} from "@/lib/careeros/inngest/trigger-workflows"
import type { CareerOSWorkflowKey } from "@/lib/careeros/inngest/workflow-catalog"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * GET — workflows the signed-in user may run on demand.
 * POST — queue one workflow or preset for the current user.
 *
 * Body: { "workflow": "preset:user-career-refresh" | "careeros/feed.personalise-pending-for-user", "data"?: {} }
 */
export async function GET() {
  if (!process.env.INNGEST_EVENT_KEY?.trim()) {
    return NextResponse.json(
      { error: "INNGEST_EVENT_KEY is not set, so queued jobs cannot be sent." },
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

  return NextResponse.json({
    ok: true,
    mode: "user",
    workflows: listWorkflowsForCaller(false),
  })
}

export async function POST(req: Request) {
  try {
    if (!process.env.INNGEST_EVENT_KEY?.trim()) {
      return NextResponse.json(
        { error: "INNGEST_EVENT_KEY is not set, so queued jobs cannot be sent." },
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

    const body = (await req.json().catch(() => ({}))) as {
      workflow?: string
      data?: Record<string, unknown>
    }
    const workflow = body.workflow?.trim()
    if (!workflow) {
      return NextResponse.json(
        { error: "workflow is required (e.g. preset:user-career-refresh)" },
        { status: 400 },
      )
    }

    if (
      workflow === "careeros/profile.extract" ||
      workflow === "preset:profile-extract"
    ) {
      const onboardingCompletionId = randomUUID()
      await mergeCareerOsOnboardingState(user.id, {
        module_1_2: {
          status: "running",
          startedAt: new Date().toISOString(),
          onboardingCompletionId,
        },
      })
      await sendCareerOSEvent({
        name: "careeros/profile.extract",
        data: {
          user_id: user.id,
          onboarding_completion_id: onboardingCompletionId,
        },
      })
      return NextResponse.json({
        ok: true,
        message:
          "Profile extract queued. Check Workspace for extraction status in a few minutes.",
        queued: [
          {
            name: "careeros/profile.extract",
            data: {
              user_id: user.id,
              onboarding_completion_id: onboardingCompletionId,
            },
          },
        ],
      })
    }

    const result = await triggerCareerOSWorkflows({
      workflow: workflow as CareerOSWorkflowKey,
      userId: user.id,
      data: body.data,
      admin: false,
    })

    return NextResponse.json({
      ok: true,
      message: "Workflow queued. Check Inngest for progress; feed and skills update in a few minutes.",
      ...result,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes("requires admin")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    return jsonApiError(500, e, "careeros/workflows/run POST")
  }
}
