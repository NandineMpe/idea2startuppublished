import { NextRequest, NextResponse } from "next/server"
import { safeErrorMessageForClient } from "@/lib/api-error-response"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { convert } from "html-to-text"
import { createClient } from "@/lib/supabase/server"
import { generateText } from "ai"

function extractJsonObject(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return {}
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { url?: string }
  const url = typeof body.url === "string" ? body.url.trim() : ""
  if (!url) {
    return NextResponse.json({ error: "URL required" }, { status: 400 })
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Juno.ai/1.0 (onboarding scraper)" },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}`, scraped: null, rawText: null },
        { status: 200 },
      )
    }

    const html = await res.text()
    const text = convert(html, {
      wordwrap: 130,
      selectors: [{ selector: "a", format: "inline" }],
    })
    const slice = text.replace(/\s+/g, " ").trim().slice(0, 8000)

    const { text: extractedText } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 1500,
      messages: [
        {
          role: "user",
          content: appendWritingRules(`Extract company information from this website text. Return JSON only:

{
  "name": "company name",
  "description": "what they do in 2-3 sentences",
  "industry": "industry/vertical",
  "product": "what the product does",
  "target_market": "who they sell to",
  "team_mentions": ["any team member names mentioned"],
  "tech_stack_hints": ["any technologies mentioned"],
  "stage_hints": "any signals about company stage (funding, team size, etc)"
}

Website text:
${slice}`),
        },
      ],
    })

    const data = extractJsonObject(extractedText)

    return NextResponse.json({
      scraped: data,
      rawText: slice.substring(0, 3000),
    })
  } catch (e: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessageForClient(e, "Scrape failed"),
        scraped: null,
        rawText: null,
      },
      { status: 200 },
    )
  }
}
