import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { buildOfficeHoursSystemPrompt, extractDesignDoc, type OfficeHoursMode } from "@/lib/juno/office-hours-prompt"
import { jsonApiError } from "@/lib/api-error-response"

/** Vercel serverless max runtime for long LLM streams (seconds). */
export const maxDuration = 300

/** Do not block the SSE on vault GitHub sync; chat must start streaming quickly. */
const CONTEXT_LOAD_MS = 12_000

async function getOfficeHoursCompanyContext(userId: string) {
  const load = getCompanyContext(userId, {
    refreshVault: "if_stale",
    useCookieOrganization: true,
  }).catch(() => null)

  const timeout = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), CONTEXT_LOAD_MS)
  })

  return (await Promise.race([load, timeout])) ?? null
}

function textFromUIMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("")
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const payload = (await req.json()) as {
      messages: UIMessage[]
      sessionId?: string
      mode?: OfficeHoursMode
    }

    const { messages, sessionId, mode } = payload
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const modelMessages = await convertToModelMessages(messages)
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const lastMessage = lastUser ? textFromUIMessage(lastUser) : ""

    // Persist user message (RLS; no service role required)
    if (sessionId) {
      supabase
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: user.id, role: "user", content: lastMessage })
        .then(({ error }) => {
          if (error) console.error("[office-hours] save user msg:", error.message)
        })
    }

    const companyCtx = await getOfficeHoursCompanyContext(user.id)

    const systemPrompt = buildOfficeHoursSystemPrompt(
      companyCtx ?? { promptBlock: "", userId: user.id, profile: {} as never, assets: [], vaultFiles: [], knowledgeHits: [], extracted: { competitors: [], keywords: [], icp: [], vertical: "", stage: "" } },
      mode,
    )

    const result = streamText({
      model: qwenModel(),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 2000,
      onFinish: async ({ text }) => {
        if (sessionId) {
          await supabase
            .from("chat_messages")
            .insert({ session_id: sessionId, user_id: user.id, role: "assistant", content: text })
            .then(({ error }) => {
              if (error) console.error("[office-hours] save assistant msg:", error.message)
            })

          await supabase
            .from("chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", sessionId)
            .then(() => {})

          const doc = extractDesignDoc(text)
          if (doc) {
            await supabase
              .from("design_docs")
              .insert({
                user_id: user.id,
                session_id: sessionId,
                mode: doc.mode,
                title: doc.title,
                doc_data: doc.doc_data,
                status: "draft",
              })
              .then(({ error }) => {
                if (error) console.error("[office-hours] save design doc:", error.message)
              })
          }
        }
      },
    })

    return result.toUIMessageStreamResponse({ originalMessages: messages })
  } catch (error) {
    return jsonApiError(500, error, "office-hours POST")
  }
}
