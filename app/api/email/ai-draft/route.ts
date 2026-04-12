import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { researchCompany } from "@/lib/juno/gtm-outreach"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { generateText } from "ai"

export const maxDuration = 60
export const dynamic = "force-dynamic"

/**
 * POST /api/email/ai-draft
 * Researches the recipient's company (via domain), loads sender context,
 * and returns an AI-drafted { subject, body }.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: "LLM not configured" }, { status: 503 })
    }

    const body = (await req.json()) as { to?: string; toName?: string; hint?: string }
    const to = body.to?.trim()
    if (!to) return NextResponse.json({ error: "to is required" }, { status: 400 })

    const toName = body.toName?.trim() || null
    const hint = body.hint?.trim() || ""

    // Extract company domain from email for research
    const domain = to.includes("@") ? to.split("@")[1].replace(/^www\./, "") : to

    // Load sender company context and research recipient in parallel
    const [context, research] = await Promise.all([
      getCompanyContext(user.id, { queryHint: "outreach email cold email ICP", refreshVault: "if_stale", useCookieWorkspace: true }),
      researchCompany(domain, hint, null).catch(() => ({
        summary: "",
        aiStance: "",
        newsHooks: [] as string[],
        outreachAngle: "",
      })),
    ])

    if (!context) {
      return NextResponse.json({ error: "Company context not found — fill in your Context page first." }, { status: 400 })
    }

    const p = context.profile
    const voice = p.brand_voice_dna?.trim() || p.brand_voice?.trim() || ""

    const prompt = `Write a short cold outreach email from a startup founder.

${context.promptBlock}

THE SENDER:
${p.founder_name || "Founder"}, ${p.name || "our company"}
Voice DNA: ${voice || "—"}
Words we lean on: ${(p.brand_words_use ?? []).join(", ") || "—"}
Words we avoid: ${(p.brand_words_never ?? []).join(", ") || "—"}

THE RECIPIENT:
${toName ? `Name: ${toName}` : "Name: unknown"}
Email: ${to}
Company: ${domain}
${hint ? `Context hint: ${hint}` : ""}

RECIPIENT COMPANY RESEARCH:
Summary: ${research.summary || "No research available."}
AI stance: ${research.aiStance || "—"}
News hooks: ${research.newsHooks.join(" | ") || "—"}
Outreach angle: ${research.outreachAngle || "—"}

RULES:
1. Subject: 6-10 words, specific to THEM, not about us.
2. No "I hope this email finds you well" or "I'm reaching out because…"
3. Open with something specific about their company or role.
4. 1-2 sentences tying their situation to the problem we solve.
5. One sentence on what we do, relevant to them.
6. Ask: "Worth a 15-minute chat?" — no demo request.
7. Under 150 words. Plain text. No HTML.

Return JSON only: {"subject":"...","body":"..."}`

    const { text } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 1200,
      messages: [{ role: "user", content: appendWritingRules(prompt) }],
    })

    const parsed = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      subject?: string
      body?: string
    }
    return NextResponse.json({
      subject: String(parsed.subject ?? "").slice(0, 300),
      body: String(parsed.body ?? ""),
    })
  } catch (err) {
    console.error("[ai-draft] error:", err)
    return NextResponse.json({ error: "Draft generation failed — try again." }, { status: 500 })
  }
}
