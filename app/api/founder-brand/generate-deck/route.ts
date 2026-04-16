import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: "LLM not configured." }, { status: 501 })
  }

  const context = await getCompanyContext(user.id)
  if (!context) {
    return NextResponse.json({ error: "No company context found. Fill in your company profile first." }, { status: 400 })
  }

  const prompt = `You are a pitch deck writer helping a startup founder.
Based on the company context below, generate a complete pitch deck in JSON format.

COMPANY CONTEXT:
${context.promptBlock}

Return ONLY a valid JSON object matching this exact shape (no markdown, no explanation):

{
  "companyName": "string — the company name",
  "tagline": "string — one crisp sentence, what the company does",
  "url": "string — website URL if known, else 'yourcompany.com'",
  "cover": {
    "label": "Cover",
    "headline": "string — company name or bold opening statement",
    "body": "string — 1–2 sentences expanding on the tagline",
    "stat": "string — a memorable number or metric (e.g. '99%', '$2M', '10x')",
    "statCaption": "string — short caption for the stat",
    "bullets": ["string — proof point 1", "string — proof point 2", "string — USP 1", "string — USP 2"]
  },
  "problem": {
    "label": "Problem",
    "headline": "string — punchy problem statement",
    "body": "string — 1–2 sentences on the pain",
    "stat": "string — a number that quantifies the problem",
    "statCaption": "string — explains the stat",
    "bullets": ["pain point 1", "pain point 2", "pain point 3", "pain point 4"]
  },
  "solution": {
    "label": "Solution",
    "headline": "string — how you fix the problem",
    "body": "string — weekly assignment or narrative note for the founder",
    "stat": "3",
    "statCaption": "string — e.g. 'Simple steps from problem to result'",
    "bullets": ["Step 1: ...", "Step 2: ...", "Step 3: ..."]
  },
  "features": {
    "label": "Features",
    "headline": "string — bold features headline",
    "body": "",
    "stat": "string — a memorable number",
    "statCaption": "string — explains the stat",
    "bullets": ["Feature name — why it matters", "Feature name — why it matters", "Feature name — why it matters", "Feature name — why it matters"]
  },
  "audience": {
    "label": "Audience",
    "headline": "string — who you serve",
    "body": "",
    "stat": "string — number of key personas",
    "statCaption": "string — explains",
    "bullets": ["Persona 1 — what they need", "Persona 2 — what they need", "Persona 3 — what they need", "Persona 4 — what they need"]
  },
  "competition": {
    "label": "Competition",
    "headline": "string — differentiation headline",
    "body": "string — how you differ",
    "stat": "1",
    "statCaption": "string — your edge in one phrase",
    "bullets": ["Alternative 1 — its weakness", "Alternative 2 — its weakness", "Your product — your edge"]
  },
  "traction": {
    "label": "Traction",
    "headline": "string — early proof headline",
    "body": "string — why now, what is working",
    "stat": "string — most impressive traction metric",
    "statCaption": "string — explains the stat",
    "bullets": ["Signal 1 — detail", "Signal 2 — detail", "Signal 3 — detail", "Signal 4 — detail"]
  },
  "backCover": {
    "label": "Back Cover",
    "headline": "string — mission or closing statement",
    "body": "string — 30-second pitch version",
    "stat": "Now",
    "statCaption": "string — call to action phrase",
    "bullets": []
  }
}

Rules:
- Be specific to this company. Reference their product name, ICP, and competitors by name.
- Every field must be filled. No placeholders like "TBD" or empty strings except bullets in backCover.
- Bullets use "Title — description" format where applicable.
- Keep headlines punchy and short (under 10 words ideally).
- The 'body' on solution slide should be the founder's weekly narrative action or context note.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 4000,
      messages: [{ role: "user", content: prompt }],
    })

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Model did not return valid JSON." }, { status: 500 })
    }

    const deck = JSON.parse(jsonMatch[0])
    return NextResponse.json({ deck })
  } catch (e) {
    console.error("[generate-deck]", e)
    return NextResponse.json({ error: "Generation failed. Try again." }, { status: 500 })
  }
}
