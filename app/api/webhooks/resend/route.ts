import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { handleResendWebhook } from "@/lib/juno/email-sender"

export const maxDuration = 30

/**
 * POST /api/webhooks/resend — Resend email events (opens, clicks, bounces).
 * Set `RESEND_WEBHOOK_SECRET` from the Resend dashboard so Svix signatures are verified (raw body required).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()

  let event: { type?: string; data?: Record<string, unknown> }

  if (secret) {
    const id = req.headers.get("svix-id")
    const timestamp = req.headers.get("svix-timestamp")
    const signature = req.headers.get("svix-signature")
    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing Svix headers" }, { status: 401 })
    }
    const resend = new Resend(process.env.RESEND_API_KEY ?? "")
    try {
      event = resend.webhooks.verify({
        payload: rawBody,
        headers: { id, timestamp, signature },
        webhookSecret: secret,
      }) as { type?: string; data?: Record<string, unknown> }
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }
  } else {
    try {
      event = JSON.parse(rawBody) as { type?: string; data?: Record<string, unknown> }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (process.env.NODE_ENV === "production") {
      console.warn("[webhooks/resend] RESEND_WEBHOOK_SECRET unset — webhooks are not verified")
    }
  }

  await handleResendWebhook(event)

  return NextResponse.json({ ok: true })
}
