import { NextRequest, NextResponse } from "next/server"
import { inngest } from "@/lib/inngest/client"

/**
 * POST /api/juno/trigger-daily-brief
 *
 * Manually trigger a daily brief for a specific user.
 * Useful for testing without waiting for the 5am cron.
 *
 * Body: { "userId": "user-uuid" }
 * Or uses JUNO_TEST_USER_ID env var if no body provided.
 *
 * Requires `INNGEST_EVENT_KEY` (Inngest Cloud → Keys) for `inngest.send` from the app.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.INNGEST_EVENT_KEY) {
      return NextResponse.json(
        {
          error:
            "INNGEST_EVENT_KEY not set — add from Inngest dashboard to send events from the app.",
        },
        { status: 501 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as { userId?: string }
    const userId = body.userId || process.env.JUNO_TEST_USER_ID

    if (!userId) {
      return NextResponse.json(
        { error: "userId required in body or JUNO_TEST_USER_ID env var" },
        { status: 400 },
      )
    }

    // Send event directly — this triggers the dailyBrief function
    await inngest.send({
      name: "juno/brief.requested",
      data: { userId, profileId: "manual-trigger" },
    })

    return NextResponse.json({
      success: true,
      message: `Daily brief triggered for user ${userId}`,
      event: "juno/brief.requested",
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
