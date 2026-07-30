import { NextResponse } from "next/server"
import { getCareerContext } from "@/lib/careeros/career-context"
import { CAREEROS_ELEVENLABS_AGENT_PROMPT } from "@/lib/careeros/run-career-chat"
import {
  careerOsAgentRequiresAuth,
  checkElevenLabsApiKey,
  fetchConversationalSignedUrl,
  fetchConversationalToken,
  getCareerOsAgentId,
  getCareerOsLlmSecret,
  getElevenLabsApiKey,
  resolveElevenLabsServerLocation,
} from "@/lib/voice/elevenlabs"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/** Widget dynamic-variables limit; full brain loads via Custom LLM + user_id. */
const SNIPPET_MAX = 1200

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasApiKey = Boolean(getElevenLabsApiKey())
  const agentId = getCareerOsAgentId()
  const serverLocation = resolveElevenLabsServerLocation()

  let careerContextSnippet = ""
  try {
    const ctx = await getCareerContext(supabase, user.id)
    careerContextSnippet = ctx.promptBlock.trim().slice(0, SNIPPET_MAX)
  } catch (e) {
    console.error("[careeros/voice/session] context", e)
  }

  const agentRequiresAuth = careerOsAgentRequiresAuth()
  let signedUrl: string | null = null
  let conversationToken: string | null = null

  const keyCheck = hasApiKey && agentId ? await checkElevenLabsApiKey(agentId, serverLocation) : null

  // Public embed widget talks to ElevenLabs from the browser; server token is optional.
  // Only call ConvAI token/signed-url when auth is required or explicitly enabled.
  const fetchServerCredentials =
    agentRequiresAuth ||
    process.env.ELEVENLABS_CAREEROS_FETCH_CONVERSATION_TOKEN?.trim().toLowerCase() === "true"

  if (hasApiKey && agentId && fetchServerCredentials && keyCheck?.ok) {
    if (agentRequiresAuth) {
      try {
        signedUrl = await fetchConversationalSignedUrl(agentId, serverLocation)
      } catch (e) {
        console.error("[careeros/voice/session] signed url", e)
      }
    } else {
      try {
        conversationToken = await fetchConversationalToken(agentId, serverLocation)
      } catch (e) {
        console.error("[careeros/voice/session] conversation token", e)
      }
    }
  }

  const connectionType =
    agentRequiresAuth && signedUrl ? "websocket" : conversationToken ? "webrtc" : "websocket"

  const apiKeyValid = keyCheck?.ok ?? false
  const voiceWarning = !hasApiKey
    ? "Set ELEVENLABS_API_KEY in Vercel (ElevenLabs → API Keys)."
    : !apiKeyValid
      ? keyCheck?.error ??
        "ElevenLabs returned 401 for your API key. Create a new key and update Vercel."
      : null

  return NextResponse.json({
    ttsAvailable: hasApiKey && apiKeyValid,
    voiceAgentAvailable: Boolean(agentId),
    agentId,
    userId: user.id,
    signedUrl,
    conversationToken,
    agentRequiresAuth,
    connectionType,
    careerContextSnippet,
    agentConfigured: Boolean(agentId),
    customLlmUrl: agentId
      ? `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://usejuno-ai.com"}/api/careeros/voice/llm/v1/chat/completions`
      : null,
    customLlmConfigured: Boolean(getCareerOsLlmSecret()),
    agentPromptTemplate: CAREEROS_ELEVENLABS_AGENT_PROMPT,
    serverLocation,
    elevenLabsApiKeyPresent: hasApiKey,
    elevenLabsApiKeyValid: apiKeyValid,
    voiceWarning,
  })
}
