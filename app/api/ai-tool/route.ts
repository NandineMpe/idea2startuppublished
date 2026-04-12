import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { runTool, TOOLS } from "@/lib/ai-tools"
import { getCompanyContextPrompt } from "@/lib/company-context"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE } from "@/lib/llm-provider"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { tool, inputs } = body

    if (!tool || !TOOLS[tool]) {
      return NextResponse.json({ error: "Invalid tool specified" }, { status: 400 })
    }

    if (!inputs || Object.keys(inputs).length === 0) {
      return NextResponse.json({ error: "Inputs are required" }, { status: 400 })
    }

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id, { useCookieWorkspace: true })

    const text = await runTool(tool, inputs, companyContext)

    // Persist output to Supabase (fire-and-forget)
    try {
      if (user) {
        const title =
          Object.values(inputs).find((v) => v && String(v).trim())
            ? String(Object.values(inputs)[0]).slice(0, 80)
            : tool

        supabase
          .from("ai_outputs")
          .insert({ user_id: user.id, tool, title, inputs, output: text })
          .then(({ error: dbErr }) => {
            if (dbErr) console.error("Failed to save ai_output:", dbErr.message)
          })
      }
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ result: text })
  } catch (error) {
    return jsonApiError(500, error, "ai-tool POST")
  }
}
