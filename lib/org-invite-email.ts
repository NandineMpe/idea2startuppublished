import { Resend } from "resend"
import { resolveAppUrl } from "@/lib/app-url"

export function buildOrganizationInviteAcceptUrl(token: string): string {
  const base = resolveAppUrl()
  return `${base}/join/${encodeURIComponent(token)}`
}

export async function sendOrganizationInviteEmail(params: {
  to: string
  inviterName: string
  organizationName: string
  acceptUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    return { ok: false, error: "Set RESEND_API_KEY and RESEND_FROM_EMAIL to send invites." }
  }

  const resend = new Resend(apiKey)
  const subject = `Join ${params.organizationName} on Juno`
  const text = [
    `${params.inviterName} invited you to join ${params.organizationName} on Juno.`,
    "",
    "Use the same email address as this message when you sign in.",
    "",
    params.acceptUrl,
    "",
    "If you did not expect this, you can ignore this email.",
  ].join("\n")

  const html = `
<p><strong>${escapeHtml(params.inviterName)}</strong> invited you to join <strong>${escapeHtml(params.organizationName)}</strong> on Juno.</p>
<p>Use the same email address as this message when you sign in.</p>
<p><a href="${escapeHtml(params.acceptUrl)}">Accept invitation</a></p>
<p style="color:#64748b;font-size:13px">If you did not expect this, you can ignore this email.</p>
`.trim()

  try {
    const { error } = await resend.emails.send({
      from,
      to: [params.to],
      subject,
      text,
      html,
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
