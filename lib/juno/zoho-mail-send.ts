/**
 * Send email via Zoho Mail using a Pipedream Connect account (proxy).
 * Falls back gracefully if no Zoho account is connected.
 */
import { PipedreamClient } from "@pipedream/sdk"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"

function getPipedreamClient(): PipedreamClient | null {
  const clientId = process.env.PIPEDREAM_CLIENT_ID
  const clientSecret = process.env.PIPEDREAM_CLIENT_SECRET
  const projectId = process.env.PIPEDREAM_PROJECT_ID
  if (!clientId || !clientSecret || !projectId) return null
  return new PipedreamClient({
    clientId,
    clientSecret,
    projectId,
    projectEnvironment: getPipedreamProjectEnvironment(),
  })
}

export type ZohoSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string }

/**
 * Looks up the user's connected Zoho Mail account via Pipedream, then sends
 * the email through Zoho's send-mail API proxied through Pipedream Connect.
 */
export async function sendViaZohoMail(params: {
  userId: string
  to: string
  toName: string
  subject: string
  body: string
}): Promise<ZohoSendResult> {
  const pd = getPipedreamClient()
  if (!pd) return { ok: false, error: "Pipedream is not configured" }

  // Get the connected Zoho Mail account for this user
  let accountId: string | null = null
  let fromAddress: string | null = null
  try {
    const page = await pd.accounts.list({
      externalUserId: params.userId,
      app: "zoho_mail",
      limit: 10,
    })
    const account = (page.data ?? []).sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
      return tb - ta
    })[0]
    if (!account) return { ok: false, error: "No Zoho Mail account connected. Connect it in Integrations." }
    accountId = account.id
    // account.name is typically the email address for Zoho Mail
    fromAddress = typeof account.name === "string" ? account.name.trim() : null
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to fetch Zoho account" }
  }

  if (!accountId) return { ok: false, error: "No Zoho Mail account connected" }

  // First get the accountId (numeric Zoho account ID) needed for the API path
  let zohoAccountId: string | null = null
  try {
    const acctRes = await pd.proxy
      .get({
        url: "https://mail.zoho.com/api/accounts",
        externalUserId: params.userId,
        accountId,
      })
      .withRawResponse()

    const raw = acctRes.data as { data?: Array<{ accountId: string; sendMailDetails?: Array<{ fromAddress: string }> }> }
    const first = raw?.data?.[0]
    zohoAccountId = first?.accountId ?? null
    // If we didn't get fromAddress from account.name, try sendMailDetails
    if (!fromAddress && first?.sendMailDetails?.[0]?.fromAddress) {
      fromAddress = first.sendMailDetails[0].fromAddress
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to get Zoho account ID" }
  }

  if (!zohoAccountId) return { ok: false, error: "Could not resolve Zoho Mail account ID" }
  if (!fromAddress) return { ok: false, error: "Could not determine Zoho from address" }

  // Send the email
  try {
    const sendRes = await pd.proxy
      .post({
        url: `https://mail.zoho.com/api/accounts/${zohoAccountId}/messages`,
        externalUserId: params.userId,
        accountId,
        headers: { "Content-Type": "application/json" },
        body: {
          fromAddress,
          toAddress: params.toName ? `${params.toName} <${params.to}>` : params.to,
          subject: params.subject,
          content: params.body,
          mailFormat: "plaintext",
        },
      })
      .withRawResponse()

    const result = sendRes.data as { status?: { code?: number; description?: string }; data?: { messageId?: string } }
    const code = result?.status?.code
    if (code !== 200 && code !== 201) {
      return { ok: false, error: result?.status?.description ?? "Zoho send failed" }
    }

    return { ok: true, messageId: result?.data?.messageId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Zoho send failed" }
  }
}
