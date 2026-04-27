import { NextResponse } from "next/server"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { jsonApiError } from "@/lib/api-error-response"
import { generateText } from "ai"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/founder/tiktok-digest
 * Synthesizes a digest for short-form (TikTok-style) founder content:
 * general AI + AI in the world of work — explicitly not audit/compliance.
 * Live TikTok scraping is not wired; the model produces a snapshot synthesis.
 */
export async function POST(req: Request) {
  try {
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    let focus = ""
    try {
      const body = (await req.json()) as { focus?: string }
      focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 500) : ""
    } catch {
      focus = ""
    }

    const today = new Date().toISOString().slice(0, 10)
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: latestBriefing } = await supabase
      .from("content_briefings")
      .select("id")
      .eq("user_id", auth.user.id)
      .not("id", "like", "audit-digest:%")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let stories: Array<{
      title: string
      url: string
      source: string
      published_at: string
      content_score: number
      hook: string
      why_it_matters: string
      connected_topics: unknown
    }> = []

    if (latestBriefing?.id) {
      const { data } = await supabase
        .from("content_stories")
        .select("title, url, source, published_at, content_score, hook, why_it_matters, connected_topics")
        .eq("user_id", auth.user.id)
        .eq("briefing_id", latestBriefing.id)
        .gte("content_score", 4)
        .order("published_at", { ascending: false })
        .order("content_score", { ascending: false })
        .limit(40)
      stories = data ?? []
    }

    const storyBlock = stories
      .map((story, i) => {
        const topics = Array.isArray(story.connected_topics) ? story.connected_topics.join(", ") : ""
        return `[${i + 1}] ${story.title}
source: ${story.source}
date: ${story.published_at}
score: ${story.content_score}
topics: ${topics}
url: ${story.url}
hook: ${story.hook}
why it matters: ${story.why_it_matters}`
      })
      .join("\n\n")

    const { text } = await generateText({
      model: qwenModel(),
      prompt: appendWritingRules(`You are helping a founder plan short-form video (TikTok / Reels / Shorts) content.

TODAY (UTC date): ${today}

SCOPE (strict):
- Include: general AI (models, labs, releases, benchmarks, open weights, major product launches).
- Include heavily: AI in the world of WORK (copilots, workplace agents, productivity, hiring, skills, AI native teams, future of work, enterprise adoption).
- Include: trending DISCUSSION angles people argue about (safety, hype, job impact, open vs closed), practical for a founder POV.
- EXCLUDE: audit, compliance, SOC2, financial audit, assurance, regulatory audit. This digest is NOT for that domain. If something touches regulation, only mention it if it is broadly about AI policy, not audit workflows.

${focus ? `Founder optional focus: ${focus}\n` : ""}
${
  storyBlock.length > 0
    ? `Expand on these digest items only for specific product names, dates, and claims (do not add other dated launch stories):\n${storyBlock}\n`
    : `No digest stories loaded yet. Say to run "Run digest now" on Public Presence first. You may still add 2–3 evergreen AI + work hook ideas without naming dated launches you do not see above.\n`
}

Output markdown with these sections:
## Releases & drops
## Trending angles & discourse
## AI × work (tools, jobs, workflows)
## Hooks for your next shorts
(3–6 concrete hook ideas, each one line)

Be concise and scannable. Label the top with one line: "Snapshot synthesis (not live TikTok scrape). Use as a briefing for what to film or react to this week."

No preamble outside the markdown.`),
      maxOutputTokens: 2500,
    })

    return NextResponse.json({ digest: text.trim(), generatedAt: new Date().toISOString() })
  } catch (e) {
    return jsonApiError(500, e, "tiktok-digest POST")
  }
}
