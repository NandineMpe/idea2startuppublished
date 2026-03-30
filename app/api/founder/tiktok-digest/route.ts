import { NextResponse } from "next/server"
import { anthropic } from "@ai-sdk/anthropic"
import { jsonApiError } from "@/lib/api-error-response"
import { generateText } from "ai"
import { appendWritingRules } from "@/lib/copy-writing-rules"

/**
 * POST /api/founder/tiktok-digest
 * Synthesizes a digest for short-form (TikTok-style) founder content:
 * general AI + AI in the world of work — explicitly not audit/compliance.
 * Live TikTok scraping is not wired; Claude produces a current snapshot synthesis.
 */
export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 })
    }

    let focus = ""
    try {
      const body = (await req.json()) as { focus?: string }
      focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 500) : ""
    } catch {
      focus = ""
    }

    const today = new Date().toISOString().slice(0, 10)

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      prompt: appendWritingRules(`You are helping a founder plan short-form video (TikTok / Reels / Shorts) content.

TODAY (UTC date): ${today}

SCOPE (strict):
- Include: general AI — models, labs, releases, benchmarks, open weights, major product launches.
- Include heavily: AI in the world of WORK — copilots, workplace agents, productivity, hiring, skills, "AI native" teams, future of work, enterprise adoption.
- Include: trending DISCUSSION angles people argue about (safety, hype, job impact, open vs closed) — keep it practical for a founder's POV.
- EXCLUDE: audit, compliance, SOC2, financial audit, assurance, regulatory audit — this digest is NOT for that domain. If something touches regulation, only mention it if it is broadly about AI policy, not audit workflows.

${focus ? `Founder optional focus: ${focus}\n` : ""}

Output markdown with these sections:
## Releases & drops
## Trending angles & discourse
## AI × work (tools, jobs, workflows)
## Hooks for your next shorts
(3–6 concrete hook ideas, each one line)

Be concise and scannable. Label the top with one line: "Snapshot synthesis (not live TikTok scrape) — use as a briefing for what to film or react to this week."

No preamble outside the markdown.`),
      maxTokens: 2500,
    })

    return NextResponse.json({ digest: text.trim(), generatedAt: new Date().toISOString() })
  } catch (e) {
    return jsonApiError(500, e, "tiktok-digest POST")
  }
}
