import { NextRequest, NextResponse } from "next/server"
import { getLlmApiKey, getLlmBaseUrl } from "@/lib/llm-provider"

/** OpenAI-compatible `/audio/transcriptions`. DashScope: `DASHSCOPE_STT_MODEL` or paraformer default; other hosts: `STT_MODEL` or whisper-1. */
function getTranscribeConfig(): { url: string; apiKey: string; model: string } {
  const apiKey = getLlmApiKey()
  const base = getLlmBaseUrl().replace(/\/+$/, "")

  const isDashScope = base.includes("dashscope") || base.includes("aliyuncs.com")

  const model = isDashScope
    ? process.env.DASHSCOPE_STT_MODEL?.trim() || "paraformer-realtime-v2"
    : process.env.STT_MODEL?.trim() || "whisper-1"

  return { url: `${base}/audio/transcriptions`, apiKey, model }
}

export async function POST(req: NextRequest) {
  const { url, apiKey, model } = getTranscribeConfig()

  if (!apiKey) {
    return NextResponse.json(
      { error: "No API key. Set DASHSCOPE_API_KEY or LLM_API_KEY (and DASHSCOPE_STT_MODEL if needed)." },
      { status: 503 },
    )
  }

  let audioBlob: Blob
  try {
    const formData = await req.formData()
    const file = formData.get("audio")
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }
    audioBlob = file
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const fd = new FormData()
  fd.append(
    "file",
    new Blob([await audioBlob.arrayBuffer()], { type: audioBlob.type || "audio/webm" }),
    "audio.webm",
  )
  fd.append("model", model)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => "")
      console.error("[transcribe] provider error:", res.status, errorText)
      return NextResponse.json(
        { error: "Transcription failed. Please try again or type your context instead." },
        { status: 502 },
      )
    }

    const data = (await res.json()) as { text?: string; error?: string }
    return NextResponse.json({ transcript: data.text?.trim() ?? "" })
  } catch (err) {
    console.error("[transcribe] error:", err)
    return NextResponse.json(
      { error: "Transcription service unavailable. Please try again or type your context instead." },
      { status: 503 },
    )
  }
}
