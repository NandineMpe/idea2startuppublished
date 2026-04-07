import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendViaZohoMail } from "@/lib/juno/zoho-mail-send"
import { sendOutreachEmailForUser } from "@/lib/juno/outreach-send-ops"

export const maxDuration = 30
export const dynamic = "force-dynamic"

/**
 * POST /api/email/compose
 * Sends via Zoho Mail (connected Pipedream account) with AgentMail/Resend fallback.
 * Inserts a row into outreach_log and marks it sent.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as {
    to?: string
    toName?: string
    subject?: string
    body?: string
  }

  const to = body.to?.trim()
  const subject = body.subject?.trim()
  const emailBody = body.body?.trim()
  // to_name is NOT NULL in DB — use email as fallback
  const toName = body.toName?.trim() || to?.split("@")[0] || "Recipient"

  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 })
  }

  // Try Zoho Mail first (user has it connected)
  const zohoResult = await sendViaZohoMail({
    userId: user.id,
    to,
    toName,
    subject,
    body: emailBody,
  })

  if (zohoResult.ok) {
    // Record in outreach_log as sent
    await supabase.from("outreach_log").insert({
      user_id: user.id,
      to_email: to,
      to_name: toName,
      subject,
      body: emailBody,
      channel: "email",
      status: "sent",
      sent_at: new Date().toISOString(),
      provider: "zoho_mail",
      provider_message_id: zohoResult.messageId ?? null,
    })

    return NextResponse.json({ ok: true, provider: "zoho_mail", messageId: zohoResult.messageId })
  }

  // Fallback: AgentMail / Resend
  const { data: row, error: insertErr } = await supabase
    .from("outreach_log")
    .insert({
      user_id: user.id,
      to_email: to,
      to_name: toName,
      subject,
      body: emailBody,
      channel: "email",
      status: "drafted",
    })
    .select("id")
    .single()

  if (insertErr || !row) {
    return NextResponse.json({ error: insertErr?.message ?? "Insert failed" }, { status: 500 })
  }

  const result = await sendOutreachEmailForUser(supabase, user.id, row.id)

  if (!result.ok) {
    // Both providers failed — surface the Zoho error as it's more actionable
    const errorMsg = zohoResult.error.includes("No Zoho Mail account")
      ? result.error
      : `Zoho: ${zohoResult.error}. Fallback: ${result.error}`
    return NextResponse.json({ error: errorMsg }, { status: result.status })
  }

  return NextResponse.json({ ok: true, provider: result.provider, messageId: result.messageId })
}
