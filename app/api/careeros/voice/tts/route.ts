import { NextResponse } from "next/server"
import { getElevenLabsApiKey, getCareerOsVoiceId, synthesizeSpeechMp3 } from "@/lib/voice/elevenlabs"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

export async function POST(req: Request) {
  if (!getElevenLabsApiKey()) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY is not set. Add it in Vercel env to enable voice." },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { text?: string; voiceId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 })
  }

  try {
    const buffer = await synthesizeSpeechMp3(
      text,
      typeof body.voiceId === "string" ? body.voiceId : getCareerOsVoiceId(),
    )
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[careeros/voice/tts]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
