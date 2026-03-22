/**
 * WhatsApp delivery via Twilio — stub until TWILIO_* env is set.
 * @see https://www.twilio.com/docs/whatsapp
 */

export async function sendWhatsAppDailyBrief(toE164: string | undefined, body: string): Promise<{ ok: boolean; detail: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!sid || !token || !from || !toE164) {
    console.log("[juno/whatsapp] stub delivery (set TWILIO_* + JUNO_WHATSAPP_TO):\n", body.slice(0, 500))
    return { ok: true, detail: "stub_logged" }
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64")
  const params = new URLSearchParams({
    To: `whatsapp:${toE164}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: body.slice(0, 1600),
  })

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error("[juno/whatsapp]", err)
    return { ok: false, detail: err }
  }

  return { ok: true, detail: "sent" }
}
