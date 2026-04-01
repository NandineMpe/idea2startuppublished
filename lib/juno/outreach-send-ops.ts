/**
 * Shared outbound send path for outreach_log rows (API routes).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { sendOutreachEmail } from "@/lib/juno/email-sender"

export type SendOutreachResult =
  | { ok: true; provider?: string; messageId?: string; threadId?: string }
  | { ok: false; error: string; status: number }

export async function sendOutreachEmailForUser(
  supabase: SupabaseClient,
  userId: string,
  outreachId: string,
): Promise<SendOutreachResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  const agentmailInboxId = process.env.AGENTMAIL_INBOX_ID?.trim()
  if (!agentmailInboxId && !from) {
    return {
      ok: false,
      error: "Configure AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID, or RESEND_FROM_EMAIL",
      status: 503,
    }
  }

  const { data: row, error: fetchErr } = await supabase
    .from("outreach_log")
    .select("id, user_id, lead_id, to_email, subject, body, status")
    .eq("id", outreachId)
    .eq("user_id", userId)
    .maybeSingle()

  if (fetchErr || !row) {
    return {
      ok: false,
      error: fetchErr?.message ?? "Not found",
      status: fetchErr ? 500 : 404,
    }
  }

  if (!["drafted", "approved"].includes(row.status)) {
    return {
      ok: false,
      error: `Cannot send from status ${row.status}`,
      status: 400,
    }
  }

  const { data: profile } = await supabase
    .from("company_profile")
    .select("founder_name")
    .eq("user_id", userId)
    .maybeSingle()

  const founder = profile?.founder_name?.trim() || "Founder"
  const replyEmail =
    process.env.AGENTMAIL_REPLY_TO?.trim() ||
    process.env.JUNO_FOUNDER_REPLY_EMAIL?.trim() ||
    process.env.RESEND_REPLY_TO?.trim() ||
    from?.match(/<([^>]+)>/)?.[1] ||
    null

  const fromHeader = from
    ? from.includes("<")
      ? from
      : `${founder} <${from}>`
    : replyEmail
      ? `${founder} <${replyEmail}>`
      : founder

  const replyTo =
    replyEmail ||
    fromHeader.match(/<([^>]+)>/)?.[1] ||
    undefined

  const result = await sendOutreachEmail({
    to: row.to_email,
    from: fromHeader,
    subject: row.subject,
    body: row.body,
    replyTo,
    leadId: row.lead_id ?? null,
    outreachId: row.id,
  })

  if (!result.success) {
    return { ok: false, error: result.error ?? "Send failed", status: 502 }
  }

  const { error: upErr } = await supabase
    .from("outreach_log")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      provider: result.provider ?? null,
      provider_message_id: result.messageId ?? null,
      provider_thread_id: result.threadId ?? null,
      provider_inbox_id: result.provider === "agentmail" ? agentmailInboxId ?? null : null,
      resend_message_id: result.provider === "resend" ? result.messageId ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", outreachId)
    .eq("user_id", userId)

  if (upErr) {
    return { ok: false, error: upErr.message, status: 500 }
  }

  return { ok: true, provider: result.provider, messageId: result.messageId, threadId: result.threadId }
}
