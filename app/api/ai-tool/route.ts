import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { runTool, TOOLS } from "@/lib/ai-tools"
import { getCompanyContextPrompt } from "@/lib/company-context"

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

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const companyContext = await getCompanyContextPrompt(user?.id)

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
    console.error("AI tool generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate" },
      { status: 500 },
    )
  }
}
