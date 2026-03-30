import { createHmac, timingSafeEqual } from "node:crypto"

/** Header n8n (or any caller) must send: hex HMAC-SHA256 of the raw JSON body, optionally prefixed with `sha256=`. */
export const N8N_WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature"

/**
 * Verifies HMAC-SHA256(secret, rawBody) against the header value.
 * Use the same secret in n8n when signing outbound webhook requests.
 */
export function verifyN8nWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret || !signatureHeader?.trim()) {
    return false
  }
  let sig = signatureHeader.trim()
  if (sig.toLowerCase().startsWith("sha256=")) {
    sig = sig.slice("sha256=".length).trim()
  }
  if (!/^[0-9a-f]+$/i.test(sig) || sig.length !== 64) {
    return false
  }
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return false
  }
}
