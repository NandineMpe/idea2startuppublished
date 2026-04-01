import { NextRequest, NextResponse } from "next/server"
import type { MessageBouncedEvent } from "agentmail"
import type { MessageComplainedEvent } from "agentmail"
import type { MessageDeliveredEvent } from "agentmail"
import type { MessageReceivedEvent } from "agentmail"
import type { MessageRejectedEvent } from "agentmail"
import type { MessageSentEvent } from "agentmail"
import { Webhook } from "svix"
import { handleAgentMailWebhook } from "@/lib/juno/email-sender"

export const maxDuration = 30

type AgentMailWebhookEvent =
  | MessageReceivedEvent
  | MessageSentEvent
  | MessageDeliveredEvent
  | MessageBouncedEvent
  | MessageComplainedEvent
  | MessageRejectedEvent

/**
 * POST /api/webhooks/agentmail — AgentMail delivery + reply events.
 * Set `AGENTMAIL_WEBHOOK_SECRET` to verify incoming Svix signatures.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const secret = process.env.AGENTMAIL_WEBHOOK_SECRET?.trim()

  let event: AgentMailWebhookEvent

  if (secret) {
    const id = req.headers.get("svix-id")
    const timestamp = req.headers.get("svix-timestamp")
    const signature = req.headers.get("svix-signature")

    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing Svix headers" }, { status: 401 })
    }

    try {
      const wh = new Webhook(secret)
      event = wh.verify(rawBody, {
        "svix-id": id,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      }) as AgentMailWebhookEvent
    } catch {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }
  } else {
    try {
      event = JSON.parse(rawBody) as AgentMailWebhookEvent
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (process.env.NODE_ENV === "production") {
      console.warn("[webhooks/agentmail] AGENTMAIL_WEBHOOK_SECRET unset — webhooks are not verified")
    }
  }

  await handleAgentMailWebhook(event)

  return NextResponse.json({ ok: true })
}
