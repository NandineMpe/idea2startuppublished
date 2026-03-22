import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendWhatsApp } from "@/lib/juno/delivery"

const E164 = /^\+[1-9]\d{6,14}$/

const TEST_BODY =
  "✅ Juno is connected! You'll receive your daily brief, lead alerts, and content approvals here."

async function sendTestWhatsApp(
  phoneNumber: string,
): Promise<{ success: boolean; error?: string; sandboxNotJoined?: boolean }> {
  const result = await sendWhatsApp(phoneNumber, TEST_BODY)
  if (result.success) return { success: true }

  const err = result.error ?? ""
  if (err.includes("63015") || err.toLowerCase().includes("sandbox")) {
    return { success: false, error: "sandbox_not_joined", sandboxNotJoined: true }
  }
  return { success: false, error: err }
}

// POST — save WhatsApp number
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { whatsappNumber?: string | null }
  const raw = body.whatsappNumber
  const whatsappNumber =
    raw === null || raw === undefined || String(raw).trim() === "" ? null : String(raw).trim()

  if (whatsappNumber && !E164.test(whatsappNumber)) {
    return NextResponse.json(
      { error: "Invalid phone number. Use international format: +353861234567" },
      { status: 400 },
    )
  }

  const { error: upsertError } = await supabase.from("company_profile").upsert(
    {
      user_id: user.id,
      whatsapp_number: whatsappNumber,
      whatsapp_verified: false,
    },
    { onConflict: "user_id" },
  )

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  if (!whatsappNumber) {
    return NextResponse.json({ saved: true, removed: true })
  }

  const testResult = await sendTestWhatsApp(whatsappNumber)
  if (testResult.success) {
    await supabase
      .from("company_profile")
      .update({ whatsapp_verified: true })
      .eq("user_id", user.id)

    return NextResponse.json({
      saved: true,
      testSent: true,
      verified: true,
    })
  }

  const needsSandboxJoin =
    testResult.sandboxNotJoined === true ||
    testResult.error === "sandbox_not_joined" ||
    (testResult.error?.includes("63015") ?? false)

  return NextResponse.json({
    saved: true,
    testSent: false,
    testError: testResult.error,
    needsSandboxJoin,
  })
}

// GET — fetch current WhatsApp settings
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data } = await supabase
    .from("company_profile")
    .select("whatsapp_number, whatsapp_verified")
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json({
    whatsappNumber: data?.whatsapp_number ?? null,
    verified: data?.whatsapp_verified ?? false,
    sandboxNumber: "+14155238886",
  })
}
