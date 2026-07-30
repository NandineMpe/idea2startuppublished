import { CAREEROS_CONVAI_AGENT_ID } from "@/lib/voice/careeros-convai-agent"

/** Response from GET /api/careeros/voice/session */
export type CareerConvaiSession = {
  ttsAvailable?: boolean
  voiceAgentAvailable?: boolean
  conversationToken?: string | null
  signedUrl?: string | null
  connectionType?: "webrtc" | "websocket" | null
  careerContextSnippet?: string
  agentConfigured?: boolean
  agentId?: string
  userId?: string | null
  customLlmUrl?: string | null
  customLlmConfigured?: boolean
  agentPromptTemplate?: string
  /** If true, widget must use signed-url (websocket). If false, agent-id + WebRTC. */
  agentRequiresAuth?: boolean
  /** ElevenLabs region: us | global | eu-residency */
  serverLocation?: string
  error?: string
}

export function buildConvaiDynamicVariables(session: CareerConvaiSession): Record<string, string> {
  const vars: Record<string, string> = {}
  if (session.careerContextSnippet?.trim()) {
    vars.career_context = session.careerContextSnippet.trim()
  }
  if (session.userId) {
    vars.user_id = session.userId
  }
  return vars
}

export function resolveConvaiAgentId(session?: CareerConvaiSession | null): string {
  return session?.agentId?.trim() || CAREEROS_CONVAI_AGENT_ID
}
