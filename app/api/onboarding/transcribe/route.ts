import { NextRequest, NextResponse } from "next/server"
import { getLlmApiKey, getLlmBaseUrl } from "@/lib/llm-provider"

/**
 * Audio transcription via the OpenAI-compatible /audio/transcriptions endpoint.
 * Works with OpenRouter (openai/whisper-1), DashScope (paraformer-realtime-v2),
 * or any other provider that exposes the endpoint.
 */
function getTranscribeConfig(): { url: string; apiKey: string; model: string } {
  const apiKey = getLlmApiKey()
  const base = getLlmBaseUrl().replace(/\/+$/, "")

  // OpenRouter uses whisper via openai/whisper-1
  const isOpenRouter = base.includes("openrouter.ai")
  const isDashScope = base.includes("dashscope") || base.includes("aliyuncs.com")

  let model: string
  if (isOpenRouter) {
    model = "openai/whisper-1"
  } else if (isDashScope) {
    model = process.env.DASHSCOPE_STT_MODEL?.trim() || "paraformer-realtime-v2"
  } else {
    // Generic OpenAI-compatible — assume whisper-1
    model = process.env.STT_MODEL?.trim() || "whisper-1"
  }

  return { url: `${base}/audio/transcriptions`, apiKey, model }
}

export async function POST(req: NextRequest) {
  const { url, apiKey, model } = getTranscribeConfig()

  if (!apiKey) {
    return NextResponse.json(
      { error: "No LLM API key configured. Set LLM_API_KEY, OPENROUTER_API_KEY, or DASHSCOPE_API_KEY." },
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
