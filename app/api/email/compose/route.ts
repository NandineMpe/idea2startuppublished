import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendOutreachEmailForUser } from "@/lib/juno/outreach-send-ops"

export const maxDuration = 30
export const dynamic = "force-dynamic"

/**
 * POST /api/email/compose
 * Insert outreach_log row and send immediately via AgentMail/Resend.
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

  if (!to || !subject || !emailBody) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 })
  }

  // Insert as drafted
  const { data: row, error: insertErr } = await supabase
    .from("outreach_log")
    .insert({
      user_id: user.id,
      to_email: to,
      to_name: body.toName?.trim() || null,
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

  // Send immediately
  const result = await sendOutreachEmailForUser(supabase, user.id, row.id)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, provider: result.provider, messageId: result.messageId })
}
