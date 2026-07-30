import { NextResponse } from "next/server"
import {
  parseElevenLabsUserId,
  streamCareerChatForCustomLlm,
  type CareerChatMessage,
} from "@/lib/careeros/run-career-chat"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE } from "@/lib/llm-provider"
import { supabaseAdmin } from "@/lib/supabase"

export const maxDuration = 60

function verifyCustomLlmAuth(req: Request): boolean {
  const secret = process.env.ELEVENLABS_CAREEROS_LLM_SECRET?.trim()
  if (!secret) return false
  const auth = req.headers.get("authorization")?.trim()
  return auth === `Bearer ${secret}`
}

export async function POST(req: Request) {
  if (!verifyCustomLlmAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY && !isLlmConfigured()) {
    return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 503 })
  }

  let body: {
    messages?: CareerChatMessage[]
    stream?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 })
  }

  if (body.stream === false) {
    return NextResponse.json(
      { error: "Non-streaming not supported; set stream: true" },
      { status: 400 },
    )
  }

  const userId = parseElevenLabsUserId(body)

  try {
    return await streamCareerChatForCustomLlm(supabaseAdmin, messages, { userId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LLM error"
    console.error("[careeros/voice/llm]", msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
