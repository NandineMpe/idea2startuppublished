import { NextResponse } from "next/server"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContextPrompt } from "@/lib/company-context"
import type { RefineSection } from "@/types/branding"

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
}

function brandingSnapshot(body: Record<string, unknown>): string {
  const ch = (body.brand_channel_voice as Record<string, unknown>) || {}
  return `
brand_voice_dna:
${String(body.brand_voice_dna ?? "").slice(0, 12000)}

brand_promise:
${String(body.brand_promise ?? "")}

brand_channel_voice.linkedin:
${String(ch.linkedin ?? "")}

brand_channel_voice.cold_email:
${String(ch.cold_email ?? "")}

brand_channel_voice.reddit_hn:
${String(ch.reddit_hn ?? "")}

brand_words_use:
${JSON.stringify(body.brand_words_use ?? [])}

brand_words_never:
${JSON.stringify(body.brand_words_never ?? [])}

brand_credibility_hooks:
${JSON.stringify(body.brand_credibility_hooks ?? [])}
`.trim()
}

export async function POST(request: Request) {
  try {
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const mode = String(body.mode ?? "draft_kit")

    const companyBlock = await getCompanyContextPrompt(user.id, {
      queryHint: "brand voice messaging founder background customers product compliance",
      useCookieWorkspace: true,
    })

    if (!companyBlock.trim()) {
      return NextResponse.json(
        { error: "Add your company context first so we have something to work from." },
        { status: 400 },
      )
    }

    if (mode === "draft_voice_dna") {
      const system = `You write IN the founder's authentic voice—not about it. The output becomes the "Voice DNA" block that every AI agent reads before generating content.

Produce demonstrated examples only (no meta commentary, no "here is a sample"). Use the company context to infer audience, product, and credibility.

Structure the output EXACTLY with these separators (include the headers):

--- LINKEDIN ---
(First-person narrative, story-led opening, 4–8 sentences—like a real post this founder would publish.)

--- COLD EMAIL ---
(Three short paragraphs: lead with the reader's pain, bridge to how you help, soft CTA. Plain text; use [Name] / [Company] placeholders if needed.)

--- REDDIT / HN ---
(Answer-first, zero marketing fluff, technical or precise where the audience expects it. 4–10 sentences.)

The three sections must sound like the SAME person. If the founder serves technical or regulated buyers (finance, security, healthcare, devtools), show appropriate precision—terms must be used correctly or omitted.

Output plain text only (no JSON).`

      const { text } = await generateText({
        model: qwenModel(),
        system,
        prompt: `${companyBlock}\n\nWrite the three demonstrated samples above.`,
        maxTokens: 3500,
      })

      const out = text.trim()
      if (!out) {
        return NextResponse.json({ error: "Empty response. Try again." }, { status: 502 })
      }

      return NextResponse.json({ brand_voice_dna: out })
    }

    if (mode === "draft_kit") {
      const system = `You are briefing AI agents that will write LinkedIn posts, cold email, Reddit replies, and internal briefs for this company.

Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "brand_voice_dna": string,
  "brand_promise": string,
  "brand_channel_voice": { "linkedin": string, "cold_email": string, "reddit_hn": string },
  "brand_words_use": string[],
  "brand_words_never": string[],
  "brand_credibility_hooks": string[]
}

Rules:
- brand_voice_dna: Use the SAME structure as in the draft_voice_dna instructions (--- LINKEDIN ---, --- COLD EMAIL ---, --- REDDIT / HN ---) with full demonstrated paragraphs in the founder's voice—not adjectives about the voice.
- brand_promise: exactly ONE sentence—the line we stand behind.
- brand_channel_voice: For each key, 2–5 sentences of channel-specific rules (how long, what to lead with, what to avoid)—not a repeat of the DNA samples.
- brand_words_use: concrete phrases this company would naturally say (domain terms, positioning)—at least 6 items when context allows.
- brand_words_never: startup clichés to ban ("revolutionize", "game-changing", "leverage AI", "seamless", "empower", "best-in-class") PLUS any misfit phrases for this buyer.
- brand_credibility_hooks: short lines agents can weave into prose (background, logos, metrics)—from context only; do not invent numbers or employers.

Tailor to the actual buyer and founder background in the context (e.g. Big Four + CFO buyer vs. indie hacker vs. clinical buyer).`

      const { text } = await generateText({
        model: qwenModel(),
        system: mergeSystemWithWritingRules(system),
        prompt: `${companyBlock}\n\nProduce the full JSON kit from the company context.`,
        maxTokens: 5000,
      })

      const parsed = parseJsonObject(text)
      if (!parsed) {
        return NextResponse.json({ error: "Could not parse AI response. Try again." }, { status: 502 })
      }

      const ch = parsed.brand_channel_voice as Record<string, unknown> | undefined
      const channel = {
        linkedin: String(ch?.linkedin ?? "").trim(),
        cold_email: String(ch?.cold_email ?? "").trim(),
        reddit_hn: String(ch?.reddit_hn ?? "").trim(),
      }

      return NextResponse.json({
        brand_voice_dna: String(parsed.brand_voice_dna ?? "").trim(),
        brand_promise: String(parsed.brand_promise ?? "").trim(),
        brand_channel_voice: channel,
        brand_words_use: asStringArray(parsed.brand_words_use),
        brand_words_never: asStringArray(parsed.brand_words_never),
        brand_credibility_hooks: asStringArray(parsed.brand_credibility_hooks),
      })
    }

    if (mode !== "refine_section") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const section = body.section as RefineSection | undefined
    const allowed: RefineSection[] = [
      "brand_voice_dna",
      "brand_promise",
      "brand_channel_linkedin",
      "brand_channel_cold_email",
      "brand_channel_reddit_hn",
      "brand_words_use",
      "brand_words_never",
      "brand_credibility_hooks",
    ]
    if (!section || !allowed.includes(section)) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    const hint = String(body.hint ?? "").trim()
    const snapshot = brandingSnapshot(body)

    const sectionPrompts: Record<RefineSection, { label: string; instruction: string; jsonKey?: string }> = {
      brand_voice_dna: {
        label: "VOICE DNA (demonstrated examples)",
        instruction:
          "Return JSON: {\"suggestion\": string} — the full Voice DNA block with --- LINKEDIN ---, --- COLD EMAIL ---, --- REDDIT / HN --- sections. Demonstrate, don't describe.",
      },
      brand_promise: {
        label: "THE LINE (one sentence)",
        instruction: 'Return JSON: {"suggestion": string} — one sentence only.',
      },
      brand_channel_linkedin: {
        label: "Channel rules: LinkedIn",
        instruction:
          'Return JSON: {"suggestion": string} — 2–6 sentences of instructions for LinkedIn only (not a post).',
      },
      brand_channel_cold_email: {
        label: "Channel rules: Cold email",
        instruction:
          'Return JSON: {"suggestion": string} — 2–6 sentences for cold email structure and tone.',
      },
      brand_channel_reddit_hn: {
        label: "Channel rules: Reddit / HN",
        instruction:
          'Return JSON: {"suggestion": string} — 2–6 sentences for Reddit/HN behavior.',
      },
      brand_words_use: {
        label: "Words we use",
        instruction:
          'Return JSON: {"suggestion": string[]} — refined list of phrases to prefer.',
        jsonKey: "array",
      },
      brand_words_never: {
        label: "Words we never use",
        instruction:
          'Return JSON: {"suggestion": string[]} — refined ban list.',
        jsonKey: "array",
      },
      brand_credibility_hooks: {
        label: "Credibility hooks",
        instruction:
          'Return JSON: {"suggestion": string[]} — short hooks agents can weave in; no invented stats.',
        jsonKey: "array",
      },
    }

    const meta = sectionPrompts[section]
    const system = `You refine brand instructions for AI writing agents. ${meta.instruction}
Honor the founder's optional direction. Stay consistent with the rest of the branding snapshot.`

    const userPrompt = `${companyBlock}

=== CURRENT BRANDING SNAPSHOT ===
${snapshot}

=== TASK ===
Refine: ${meta.label}
${hint ? `\nFounder direction: ${hint}\n` : ""}

Output only the JSON object requested.`

    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(system),
      prompt: userPrompt,
      maxTokens: section.startsWith("brand_words") || section === "brand_credibility_hooks" ? 2000 : 3500,
    })

    const parsed = parseJsonObject(text)
    if (!parsed || parsed.suggestion === undefined) {
      return NextResponse.json({ error: "Could not parse refinement. Try again." }, { status: 502 })
    }

    if (meta.jsonKey === "array") {
      const arr = asStringArray(parsed.suggestion)
      if (arr.length === 0) {
        return NextResponse.json({ error: "Empty suggestion." }, { status: 502 })
      }
      return NextResponse.json({ suggestion: arr })
    }

    const suggestion = String(parsed.suggestion ?? "").trim()
    if (!suggestion) {
      return NextResponse.json({ error: "Empty suggestion." }, { status: 502 })
    }

    return NextResponse.json({ suggestion })
  } catch (e) {
    console.error("branding-suggest:", e)
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 })
  }
}
