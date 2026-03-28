import { Resend } from "resend"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env for email sender")
  return createClient(url, key)
}

export type EmailToSend = {
  to: string
  from: string
  subject: string
  body: string
  replyTo: string
  leadId: string | null
  outreachId?: string
}

export async function sendOutreachEmail(
  email: EmailToSend,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY not configured" }
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

    return { success: true, messageId: data?.id }
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : "send failed" }
  }
}

// ─── Resend webhook (email.delivered, email.opened, etc.) ─────────

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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (type === "email.opened") {
    patch.opened_at = new Date().toISOString()
    patch.status = "opened"
  } else if (type === "email.clicked") {
    patch.clicked_at = new Date().toISOString()
    patch.status = "clicked"
  } else if (type === "email.bounced") {
    patch.status = "bounced"
    const bounce = event.data?.bounce as { message?: string } | undefined
    patch.bounce_reason = bounce?.message ?? "bounced"
  } else if (type === "email.complained") {
    patch.status = "complained"
  } else if (type === "email.delivered" || type === "email.sent") {
    patch.status = "sent"
    patch.sent_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from("outreach_log")
    .update(patch)
    .eq("resend_message_id", emailId)

  if (error) {
    console.error("[Resend webhook] update outreach_log:", error.message)
  }
}
