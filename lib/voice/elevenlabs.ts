import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js"
import { CAREEROS_CONVAI_AGENT_ID } from "@/lib/voice/careeros-convai-agent"

/** Default: George (professional, clear). Override with ELEVENLABS_CAREEROS_VOICE_ID. */
export const DEFAULT_CAREEROS_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"

export function getElevenLabsApiKey(): string | null {
  const key = process.env.ELEVENLABS_API_KEY?.trim()
  return key || null
}

/** Match agent/widget region (US agents use api.us.elevenlabs.io). */
export function getElevenLabsApiBase(serverLocation?: string): string {
  const loc = (
    serverLocation ||
    process.env.ELEVENLABS_SERVER_LOCATION ||
    process.env.NEXT_PUBLIC_ELEVENLABS_SERVER_LOCATION ||
    "us"
  )
    .trim()
    .toLowerCase()

  if (loc === "us") return "https://api.us.elevenlabs.io"
  if (loc === "eu-residency" || loc === "eu") return "https://api.eu.residency.elevenlabs.io"
  if (loc === "in-residency" || loc === "in") return "https://api.in.residency.elevenlabs.io"
  return "https://api.elevenlabs.io"
}

export function resolveElevenLabsServerLocation(): string {
  return (
    process.env.NEXT_PUBLIC_ELEVENLABS_SERVER_LOCATION?.trim() ||
    process.env.ELEVENLABS_SERVER_LOCATION?.trim() ||
    "us"
  )
}

export type ElevenLabsKeyCheck = {
  ok: boolean
  status: number | null
  error: string | null
}

/** Probes ConvAI token endpoint; 401 = invalid or revoked API key in Vercel. */
export async function checkElevenLabsApiKey(
  agentId: string,
  serverLocation?: string,
): Promise<ElevenLabsKeyCheck> {
  const apiKey = getElevenLabsApiKey()
  if (!apiKey) {
    return { ok: false, status: null, error: "ELEVENLABS_API_KEY is not set in Vercel" }
  }

  const base = getElevenLabsApiBase(serverLocation)
  const url = new URL(`${base}/v1/convai/conversation/token`)
  url.searchParams.set("agent_id", agentId)

  try {
    const res = await fetch(url.toString(), {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    })
    if (res.ok) return { ok: true, status: res.status, error: null }
    const body = await res.text().catch(() => "")
    return {
      ok: false,
      status: res.status,
      error: `ElevenLabs rejected the API key (${res.status}): ${body.slice(0, 160)}`,
    }
  } catch (e) {
    return {
      ok: false,
      status: null,
      error: e instanceof Error ? e.message : "ElevenLabs request failed",
    }
  }
}

export function getCareerOsVoiceId(): string {
  return process.env.ELEVENLABS_CAREEROS_VOICE_ID?.trim() || DEFAULT_CAREEROS_VOICE_ID
}

export function getCareerOsAgentId(): string {
  return process.env.ELEVENLABS_CAREEROS_AGENT_ID?.trim() || CAREEROS_CONVAI_AGENT_ID
}

/** When false (default), widget uses agent-id + WebRTC. When true, uses signed-url (websocket). */
export function careerOsAgentRequiresAuth(): boolean {
  const v = process.env.ELEVENLABS_CAREEROS_AGENT_REQUIRES_AUTH?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

export function createElevenLabsClient(): ElevenLabsClient | null {
  const apiKey = getElevenLabsApiKey()
  if (!apiKey) return null
  return new ElevenLabsClient({ apiKey })
}

/** Strip markdown-ish noise and cap length for TTS latency. */
export function textForSpeech(raw: string, maxChars = 2800): string {
  const t = raw
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`+/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, maxChars).trim()}...`
}

export async function synthesizeSpeechMp3(text: string, voiceId?: string): Promise<Buffer> {
  const client = createElevenLabsClient()
  if (!client) {
    throw new Error("ELEVENLABS_API_KEY is not configured")
  }

  const audio = await client.textToSpeech.convert(voiceId ?? getCareerOsVoiceId(), {
    text: textForSpeech(text),
    modelId: "eleven_flash_v2_5",
    outputFormat: "mp3_44100_128",
  })

  const chunks: Uint8Array[] = []
  for await (const chunk of audio) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export function getCareerOsLlmSecret(): string | null {
  return process.env.ELEVENLABS_CAREEROS_LLM_SECRET?.trim() || null
}

/** WebRTC token — preferred for duplex voice (turn-taking, interruptions). */
export async function fetchConversationalToken(
  agentId: string,
  serverLocation?: string,
): Promise<string> {
  const apiKey = getElevenLabsApiKey()
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured")

  const url = new URL(`${getElevenLabsApiBase(serverLocation)}/v1/convai/conversation/token`)
  url.searchParams.set("agent_id", agentId)

  const res = await fetch(url.toString(), {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`ElevenLabs conversation token failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new Error("ElevenLabs returned no token")
  return data.token
}

export async function fetchConversationalSignedUrl(
  agentId: string,
  serverLocation?: string,
): Promise<string> {
  const apiKey = getElevenLabsApiKey()
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured")

  const url = new URL(
    `${getElevenLabsApiBase(serverLocation)}/v1/convai/conversation/get-signed-url`,
  )
  url.searchParams.set("agent_id", agentId)

  const res = await fetch(url.toString(), {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`ElevenLabs signed URL failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { signed_url?: string }
  if (!data.signed_url) throw new Error("ElevenLabs returned no signed_url")
  return data.signed_url
}
