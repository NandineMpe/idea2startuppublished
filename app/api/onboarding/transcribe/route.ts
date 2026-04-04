"use server"

import { NextRequest, NextResponse } from "next/server"
import { getServerEnv } from "@/lib/server-env"

const DASHSCOPE_BASE_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

function getDashScopeKey() {
  return (
    getServerEnv("DASHSCOPE_API_KEY") ||
    getServerEnv("LLM_API_KEY") ||
    ""
  )
}

function getDashScopeBase() {
  const explicit = getServerEnv("LLM_BASE_URL") || getServerEnv("DASHSCOPE_BASE_URL")
  if (explicit) return explicit.replace(/\/+$/, "")

  const region = getServerEnv("DASHSCOPE_REGION")?.trim().toLowerCase()
  if (region === "us") return "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
  if (region === "cn" || region === "beijing") return "https://dashscope.aliyuncs.com/compatible-mode/v1"
  if (region === "hk") return "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1"

  return DASHSCOPE_BASE_INTL
}

export async function POST(req: NextRequest) {
  const apiKey = getDashScopeKey()
  if (!apiKey) {
    return NextResponse.json({ error: "DASHSCOPE_API_KEY not configured" }, { status: 503 })
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

  // Convert blob to base64 for DashScope paraformer REST API
  const arrayBuffer = await audioBlob.arrayBuffer()
  const base64Audio = Buffer.from(arrayBuffer).toString("base64")

  // DashScope paraformer-v2 (Fun-ASR) via OpenAI-compatible audio transcriptions endpoint
  const base = getDashScopeBase()
  const transcribeUrl = `${base}/audio/transcriptions`

  try {
    // Use multipart form (same as OpenAI Whisper API — DashScope is compatible)
    const fd = new FormData()
    fd.append(
      "file",
      new Blob([Buffer.from(base64Audio, "base64")], { type: audioBlob.type || "audio/webm" }),
      "audio.webm",
    )
    fd.append("model", "paraformer-realtime-v2")

    const res = await fetch(transcribeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: fd,
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => "")
      console.error("DashScope transcribe error:", res.status, errorText)
      return NextResponse.json(
        { error: "Transcription failed. Please try again or type your context instead." },
        { status: 502 },
      )
    }

    const data = (await res.json()) as { text?: string; error?: string }
    const transcript = data.text?.trim() ?? ""

    return NextResponse.json({ transcript })
  } catch (err) {
    console.error("Transcription error:", err)
    return NextResponse.json({ error: "Transcription service unavailable" }, { status: 503 })
  }
}
