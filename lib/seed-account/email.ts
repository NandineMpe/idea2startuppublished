/**
 * "If I was your agent" — the cold outreach email sent after seeding.
 *
 * Sent via AgentMail (the outreach agent's inbox) so replies land in
 * the same inbox Juno uses for all outreach — threads, tracking, and
 * reply handling all work automatically.
 * Falls back to Resend if AgentMail is not configured.
 *
 * Tone: personal from Nandine, not marketing copy.
 */

import { AgentMailClient } from "agentmail"
import { Resend } from "resend"
import { resolveAppUrl } from "@/lib/app-url"
import type { EmailPreviewBullets } from "./synthesizer"

export interface SendSeedEmailParams {
  toEmail: string
  founderName: string        // first name only for greeting
  companyName: string
  claimToken: string
  emailPreview: EmailPreviewBullets
}

function buildClaimUrl(token: string): string {
  return `${resolveAppUrl()}/claim/${encodeURIComponent(token)}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildTextEmail(params: SendSeedEmailParams, claimUrl: string): string {
  const { founderName, companyName, emailPreview } = params
  const firstName = founderName.split(" ")[0]

  return [
    `Hey ${firstName},`,
    "",
    `I built Juno for myself — an AI agent I use every day to stay on top of ${companyName}'s market, competitors, and pipeline. It's the thing I wish I had in year one.`,
    "",
    `I've seeded a version of it for ${companyName}. Here's what it surfaced this morning:`,
    "",
    `→ ${emailPreview.market_signal}`,
    `→ ${emailPreview.competitor_move}`,
    `→ ${emailPreview.icp_insight}`,
    "",
    `Your account is already set up — no forms, no onboarding, no blank dashboard.`,
    "",
    `Claim it here: ${claimUrl}`,
    "",
    `It took me four months to get this running for myself. You can have it in 60 seconds.`,
    "",
    "— Nandine",
    "Founder, Juno",
  ].join("\n")
}

function buildHtmlEmail(params: SendSeedEmailParams, claimUrl: string): string {
  const { founderName, companyName, emailPreview } = params
  const firstName = escapeHtml(founderName.split(" ")[0])
  const safeCompany = escapeHtml(companyName)
  const safeUrl = escapeHtml(claimUrl)
  const bullet1 = escapeHtml(emailPreview.market_signal)
  const bullet2 = escapeHtml(emailPreview.competitor_move)
  const bullet3 = escapeHtml(emailPreview.icp_insight)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Juno — your account is ready</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Logo / wordmark -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:18px;font-weight:700;letter-spacing:-0.5px;color:#ffffff;">Juno</span>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="color:#e5e5e5;font-size:15px;line-height:1.6;padding-bottom:20px;">
              Hey ${firstName},
            </td>
          </tr>

          <tr>
            <td style="color:#a3a3a3;font-size:15px;line-height:1.7;padding-bottom:20px;">
              I built Juno for myself — an AI agent I use every day to stay on top of my market,
              competitors, and pipeline. It's the thing I wish I had in year one.
              <br/><br/>
              I've seeded a version for <strong style="color:#e5e5e5;">${safeCompany}</strong>.
              Here's what it surfaced this morning:
            </td>
          </tr>

          <!-- Intelligence bullets -->
          <tr>
            <td style="padding-bottom:28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#141414;border:1px solid #262626;border-radius:10px;padding:20px 24px;">
                <tr>
                  <td style="color:#a3a3a3;font-size:13px;font-weight:600;letter-spacing:0.08em;
                              text-transform:uppercase;padding-bottom:16px;">
                    This morning's intelligence
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="color:#6366f1;font-size:14px;padding-right:10px;vertical-align:top;">→</td>
                        <td style="color:#d4d4d4;font-size:14px;line-height:1.6;">${bullet1}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:12px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="color:#6366f1;font-size:14px;padding-right:10px;vertical-align:top;">→</td>
                        <td style="color:#d4d4d4;font-size:14px;line-height:1.6;">${bullet2}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td>
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="color:#6366f1;font-size:14px;padding-right:10px;vertical-align:top;">→</td>
                        <td style="color:#d4d4d4;font-size:14px;line-height:1.6;">${bullet3}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body copy -->
          <tr>
            <td style="color:#a3a3a3;font-size:15px;line-height:1.7;padding-bottom:28px;">
              Your account is already set up — no forms, no onboarding, no blank dashboard.
              <br/><br/>
              It took me four months to get this running for myself.
              You can have it in 60 seconds.
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding-bottom:36px;">
              <a href="${safeUrl}"
                 style="display:inline-block;background:#6366f1;color:#ffffff;font-size:15px;
                        font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;
                        letter-spacing:-0.2px;">
                Claim your account →
              </a>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="color:#525252;font-size:14px;line-height:1.6;border-top:1px solid #1f1f1f;padding-top:24px;">
              — Nandine<br/>
              <span style="color:#404040;">Founder, Juno</span>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;color:#3f3f3f;font-size:12px;line-height:1.5;">
              This email was sent because Nandine manually seeded this account for you.
              No subscription, no tracking pixel. Just a founder showing another founder
              what's possible.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function sendSeedEmail(
  params: SendSeedEmailParams,
): Promise<{ ok: boolean; error?: string; messageId?: string; provider?: string }> {
  const claimUrl = buildClaimUrl(params.claimToken)
  const subject  = `Juno already mapped ${params.companyName}'s market`
  const text     = buildTextEmail(params, claimUrl)
  const html     = buildHtmlEmail(params, claimUrl)

  // ── AgentMail (preferred) ────────────────────────────────────────────────
  const agentMailKey    = process.env.AGENTMAIL_API_KEY?.trim()
  const agentMailInbox  = process.env.AGENTMAIL_INBOX_ID?.trim()

  if (agentMailKey && agentMailInbox) {
    try {
      const client = new AgentMailClient({ apiKey: agentMailKey })
      const replyTo = process.env.AGENTMAIL_REPLY_TO?.trim()
      const sent = await client.inboxes.messages.send(agentMailInbox, {
        to: [params.toEmail],
        subject,
        text,
        html,
        ...(replyTo ? { replyTo: [replyTo] } : {}),
        labels: ["juno-seed-outreach"],
        headers: { "X-Juno-Seed": "true" },
      })
      return { ok: true, messageId: sent.messageId, provider: "agentmail" }
    } catch (e: unknown) {
      // fall through to Resend
      console.warn("[seed-email] AgentMail failed, trying Resend:", e instanceof Error ? e.message : e)
    }
  }

  // ── Resend (fallback) ────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim()

  if (!resendKey || !resendFrom) {
    return { ok: false, error: "No email provider configured (AGENTMAIL_API_KEY + AGENTMAIL_INBOX_ID, or RESEND_API_KEY + RESEND_FROM_EMAIL)" }
  }

  try {
    const resend = new Resend(resendKey)
    const { data, error } = await resend.emails.send({
      from: resendFrom,
      to: [params.toEmail],
      subject,
      text,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, messageId: data?.id, provider: "resend" }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" }
  }
}
