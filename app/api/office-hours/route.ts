import { anthropic } from "@ai-sdk/anthropic"
import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getCompanyContext } from "@/lib/company-context"
import { buildOfficeHoursSystemPrompt, extractDesignDoc, type OfficeHoursMode } from "@/lib/juno/office-hours-prompt"
import { jsonApiError } from "@/lib/api-error-response"

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

    // Persist user message
    if (sessionId) {
      supabaseAdmin
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: user.id, role: "user", content: lastMessage })
        .then(({ error }) => {
          if (error) console.error("[office-hours] save user msg:", error.message)
        })
    }

    // Load company context to ground the advisor in the user's actual business
    const companyCtx = await getCompanyContext(user.id).catch(() => null)

    const systemPrompt = buildOfficeHoursSystemPrompt(
      companyCtx ?? { promptBlock: "", userId: user.id, profile: {} as never, assets: [], vaultFiles: [], memoryHits: [], extracted: { competitors: [], keywords: [], icp: [], vertical: "", stage: "" } },
      mode,
    )

    const result = streamText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: modelMessages,
      maxOutputTokens: 2000,
      onFinish: async ({ text }) => {
        // Persist assistant response
        if (sessionId) {
          await supabaseAdmin
            .from("chat_messages")
            .insert({ session_id: sessionId, user_id: user.id, role: "assistant", content: text })
            .then(({ error }) => {
              if (error) console.error("[office-hours] save assistant msg:", error.message)
            })

          // Update session timestamp
          await supabaseAdmin
            .from("chat_sessions")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", sessionId)
            .then(() => {})

          // Check for design doc completion
          const doc = extractDesignDoc(text)
          if (doc) {
            await supabaseAdmin
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

    return result.toUIMessageStreamResponse()
  } catch (error) {
    return jsonApiError(500, error, "office-hours POST")
  }
}
