import type { MessageBouncedEvent } from "agentmail"
import type { MessageComplainedEvent } from "agentmail"
import type { MessageDeliveredEvent } from "agentmail"
import type { MessageReceivedEvent } from "agentmail"
import type { MessageRejectedEvent } from "agentmail"
import type { MessageSentEvent } from "agentmail"
import { AgentMailClient } from "agentmail"
import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env for email sender")
  return createClient(url, key)
}

function getAgentMailClient() {
  const apiKey = process.env.AGENTMAIL_API_KEY?.trim()
  if (!apiKey) return null
  return new AgentMailClient({ apiKey })
}

function getAgentMailInboxId() {
  return process.env.AGENTMAIL_INBOX_ID?.trim() || null
}

function getConfiguredProvider(): "agentmail" | "resend" | null {
  if (getAgentMailClient() && getAgentMailInboxId()) return "agentmail"
  if (process.env.RESEND_API_KEY?.trim()) return "resend"
  return null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function textToHtml(text: string): string {
  const escaped = escapeHtml(text.trim())
  const blocks = escaped.split(/\n{2,}/).map((block) => block.replace(/\n/g, "<br />"))
  return blocks.map((block) => `<p>${block}</p>`).join("")
}

export type EmailToSend = {
  to: string
  from?: string
  subject: string
  body: string
  replyTo?: string
  leadId: string | null
  outreachId?: string
}

export type SentEmailResult = {
  success: boolean
  provider?: "agentmail" | "resend"
  inboxId?: string
  messageId?: string
  threadId?: string
  error?: string
}

export async function sendOutreachEmail(email: EmailToSend): Promise<SentEmailResult> {
  const provider = getConfiguredProvider()
  if (!provider) {
    return {
      success: false,
      error: "No outbound provider configured (set AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID, or RESEND_API_KEY)",
    }
  }

  if (provider === "agentmail") {
    const client = getAgentMailClient()
    const inboxId = getAgentMailInboxId()
    if (!client || !inboxId) {
      return { success: false, error: "AGENTMAIL_API_KEY or AGENTMAIL_INBOX_ID not configured" }
    }

    try {
      const sent = await client.inboxes.messages.send(inboxId, {
        to: [email.to],
        subject: email.subject,
        text: email.body,
        html: textToHtml(email.body),
        replyTo: email.replyTo ? [email.replyTo] : undefined,
        labels: ["juno-outreach"],
        headers: {
          ...(email.leadId ? { "X-Juno-Lead-Id": email.leadId } : {}),
          ...(email.outreachId ? { "X-Juno-Outreach-Id": email.outreachId } : {}),
        },
      })

      return {
        success: true,
        provider: "agentmail",
        inboxId,
        messageId: sent.messageId,
        threadId: sent.threadId,
      }
    } catch (e: unknown) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "AgentMail send failed",
      }
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" }
  }
  if (!email.from) {
    return { success: false, error: "RESEND_FROM_EMAIL not configured" }
  }

  const resend = new Resend(apiKey)

  try {
    const { data, error } = await resend.emails.send({
      from: email.from,
      to: [email.to],
      subject: email.subject,
      text: email.body,
      replyTo: email.replyTo,
      headers: {
        ...(email.leadId ? { "X-Juno-Lead-Id": email.leadId } : {}),
        ...(email.outreachId ? { "X-Juno-Outreach-Id": email.outreachId } : {}),
      },
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      provider: "resend",
      messageId: data?.id,
    }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "send failed" }
  }
}

type AgentMailWebhookEvent =
  | MessageReceivedEvent
  | MessageSentEvent
  | MessageDeliveredEvent
  | MessageBouncedEvent
  | MessageComplainedEvent
  | MessageRejectedEvent

function nowIso() {
  return new Date().toISOString()
}

export async function handleAgentMailWebhook(event: AgentMailWebhookEvent): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return
  }

  const supabase = getServiceClient()

  if (event.eventType === "message.received") {
    const { error } = await supabase
      .from("outreach_log")
      .update({
        status: "replied",
        replied_at: event.message.timestamp ?? nowIso(),
        updated_at: nowIso(),
      })
      .eq("provider", "agentmail")
      .eq("provider_thread_id", event.thread.threadId)

    if (error) {
      console.error("[AgentMail webhook] message.received update outreach_log:", error.message)
    }
    return
  }

  if (event.eventType === "message.sent") {
    const { error } = await supabase
      .from("outreach_log")
      .update({
        status: "sent",
        sent_at: event.send.timestamp ?? nowIso(),
        updated_at: nowIso(),
      })
      .eq("provider", "agentmail")
      .eq("provider_message_id", event.send.messageId)

    if (error) {
      console.error("[AgentMail webhook] message.sent update outreach_log:", error.message)
    }
    return
  }

  if (event.eventType === "message.delivered") {
    const { error } = await supabase
      .from("outreach_log")
      .update({
        status: "delivered",
        updated_at: nowIso(),
      })
      .eq("provider", "agentmail")
      .eq("provider_message_id", event.delivery.messageId)

    if (error) {
      console.error("[AgentMail webhook] message.delivered update outreach_log:", error.message)
    }
    return
  }

  if (event.eventType === "message.bounced") {
    const reason = [event.bounce.type, event.bounce.subType].filter(Boolean).join(" / ") || "bounced"
    const { error } = await supabase
      .from("outreach_log")
      .update({
        status: "bounced",
        bounce_reason: reason,
        updated_at: nowIso(),
      })
      .eq("provider", "agentmail")
      .eq("provider_message_id", event.bounce.messageId)

    if (error) {
      console.error("[AgentMail webhook] message.bounced update outreach_log:", error.message)
    }
    return
  }

  if (event.eventType === "message.complained") {
    const reason =
      [event.complaint.type, event.complaint.subType].filter(Boolean).join(" / ") || "complained"
    const { error } = await supabase
      .from("outreach_log")
      .update({
        status: "complained",
        bounce_reason: reason,
        updated_at: nowIso(),
      })
      .eq("provider", "agentmail")
      .eq("provider_message_id", event.complaint.messageId)

    if (error) {
      console.error("[AgentMail webhook] message.complained update outreach_log:", error.message)
    }
    return
  }

  if (event.eventType === "message.rejected") {
    const { error } = await supabase
      .from("outreach_log")
      .update({
        status: "rejected",
        bounce_reason: event.reject.reason,
        updated_at: nowIso(),
      })
      .eq("provider", "agentmail")
      .eq("provider_message_id", event.reject.messageId)

    if (error) {
      console.error("[AgentMail webhook] message.rejected update outreach_log:", error.message)
    }
  }
}

// Legacy Resend webhook support for older deployments / existing rows.
export async function handleResendWebhook(event: {
  type?: string
  data?: Record<string, unknown>
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return
  }

  const supabase = getServiceClient()
  const emailId =
    typeof event.data?.email_id === "string"
      ? event.data.email_id
      : typeof event.data?.id === "string"
        ? event.data.id
        : null

  if (!emailId) return

  const type = event.type ?? ""
  const patch: Record<string, unknown> = { updated_at: nowIso() }

  if (type === "email.opened") {
    patch.opened_at = nowIso()
    patch.status = "opened"
  } else if (type === "email.clicked") {
    patch.clicked_at = nowIso()
    patch.status = "clicked"
  } else if (type === "email.bounced") {
    patch.status = "bounced"
    const bounce = event.data?.bounce as { message?: string } | undefined
    patch.bounce_reason = bounce?.message ?? "bounced"
  } else if (type === "email.complained") {
    patch.status = "complained"
  } else if (type === "email.delivered" || type === "email.sent") {
    patch.status = "sent"
    patch.sent_at = nowIso()
  }

  const { error } = await supabase
    .from("outreach_log")
    .update(patch)
    .eq("resend_message_id", emailId)

  if (error) {
    console.error("[Resend webhook] update outreach_log:", error.message)
  }
}
