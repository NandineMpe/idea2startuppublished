import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isProduction } from "@/lib/api-error-response"
import { generateText } from "ai"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { fetchAllAuditAiItems, type AuditRawItem } from "@/lib/content-intelligence/audit-ai-sources"

const AUDIT_DIGEST_SYSTEM = `You are an investigative journalist writing a magazine feature on how AI is reshaping audit and assurance. Your reader is a founder selling AI-powered audit technology to mid-market and Big Four firms.

You will receive a batch of raw signals (tweets, articles, news) from the last 45 days about AI in audit.

Produce a single JSON object with these fields:

headline (string): Magazine cover headline. Punchy, factual, names firms.
subhead (string): One sentence expanding on headline.
executiveSummary (string): 3-4 paragraph magazine lede. Tell the full arc: who moved, what happened, why it matters for audit practice. Name KPMG, Deloitte, EY, PwC, BDO, Grant Thornton, PCAOB, AICPA where they appear.
timeline (array of objects): Chronological events, each with date (ISO string or "recent"), actor (firm/regulator name), event (what happened, under 200 chars), significance (why it matters, under 300 chars), sourceUrl (string or null).
firmProfiles (array of objects): Per-firm breakdown with name, stance (string, their position on AI audit), moves (string, specific actions taken), quote (verbatim quote if available, else null), assessment (your analyst judgment on where they stand).
regulatoryLandscape (string): 2-3 paragraphs on PCAOB, AICPA, SEC, EU positions.
marketImplications (string): What this means for buyers, builders, and sellers of audit tech.
whatToWatch (array of strings): 5-8 specific things to monitor in the next 90 days.
rawSourceCount (number): How many raw items you were given.

Be direct. Use names, numbers, dates. Skip filler. This is an in-depth feature, not a summary.`

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: cached } = await supabase
    .from("content_briefings")
    .select("id, summary, generated_at")
    .eq("user_id", auth.user.id)
    .like("id", "audit-digest:%")
    .order("generated_at", { ascending: false })
    .limit(1)

  if (cached && cached.length > 0) {
    const age = Date.now() - new Date(cached[0].generated_at).getTime()
    if (age < 6 * 60 * 60 * 1000) {
      try {
        const parsed = JSON.parse(cached[0].summary)
        return NextResponse.json({ digest: parsed, cached: true, generatedAt: cached[0].generated_at })
      } catch {
        // stale or corrupt, regenerate
      }
    }
  }

  return NextResponse.json({
    digest: null,
    cached: false,
    message: "Use POST to generate a fresh audit digest.",
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: "LLM not configured" }, { status: 500 })
  }

  const items = await fetchAllAuditAiItems()

  if (items.length === 0) {
    return NextResponse.json({
      digest: null,
      error:
        "No audit AI items found. Add BYCRAWL_API_KEY in production for X and Google News, or wait for RSS feeds to return matching stories.",
    })
  }

  /** Keep prompts within model context limits and reduce timeouts (AI SDK 6 uses maxOutputTokens, not maxTokens). */
  const LLM_ITEM_CAP = 72
  const itemsForLlm = items.length > LLM_ITEM_CAP ? items.slice(0, LLM_ITEM_CAP) : items
  const userPayload = buildUserPayload(itemsForLlm, items.length)

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(AUDIT_DIGEST_SYSTEM),
      prompt: userPayload,
      maxOutputTokens: 8000,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(110_000),
    })

    const digest = extractJson(text)
    if (!digest) {
      return NextResponse.json({
        digest: null,
        error: "LLM returned unparseable output. Raw items fetched: " + items.length,
        rawPreview: items.slice(0, 5).map((i) => ({ title: i.title, source: i.source, url: i.url })),
      })
    }

    digest.rawSourceCount = items.length

    const briefingId = `audit-digest:${auth.user.id}:${Date.now()}`
    const { error: persistError } = await supabase.from("content_briefings").upsert(
      {
        id: briefingId,
        user_id: auth.user.id,
        generated_at: new Date().toISOString(),
        angle: "AI in audit - 45 day compilation",
        summary: JSON.stringify(digest),
        top_hook: digest.headline ?? "AI in Audit",
        connections: [],
        story_count: items.length,
        breaking_count: 0,
      },
      { onConflict: "id" },
    )
    if (persistError) {
      console.error("[audit-digest] content_briefings upsert:", persistError.message)
    }

    return NextResponse.json({
      digest,
      cached: false,
      generatedAt: new Date().toISOString(),
      sourceCount: items.length,
    })
  } catch (e) {
    console.error("[audit-digest] Generation failed:", e)
    const message = e instanceof Error ? e.message : String(e)
    const isTimeout = /abort|timeout|timed out/i.test(message)
    const userMsg = isTimeout
      ? "Compilation timed out. Try again in a minute."
      : isProduction()
        ? "Compilation failed. Check LLM API keys and try again."
        : `Compilation failed: ${message}`
    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}

const SNIPPET_MAX = 420

function buildUserPayload(items: AuditRawItem[], totalFetched: number): string {
  const sorted = [...items].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  )

  const lines = sorted.map((item, i) => {
    const date = new Date(item.publishedAt).toISOString().slice(0, 10)
    const snippet = item.snippet.length > SNIPPET_MAX ? `${item.snippet.slice(0, SNIPPET_MAX)}…` : item.snippet
    return `[${i}] date: ${date}\ntitle: ${item.title}\nsource: ${item.source}\nurl: ${item.url}\nauthor: ${item.author ?? "unknown"}\nsnippet: ${snippet}`
  })

  const capNote = items.length < totalFetched ? ` (showing ${items.length} of ${totalFetched} fetched, newest first)` : ""

  return `Below are ${items.length} raw signals about AI in audit from the last 45 days${capNote}. Synthesize them into the magazine feature format described in your instructions.\n\n${lines.join("\n\n")}`
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : text.trim()

  const starts = [candidate.indexOf("{")]
  for (const start of starts) {
    if (start === -1) continue
    let depth = 0
    for (let i = start; i < candidate.length; i++) {
      if (candidate[i] === "{") depth++
      if (candidate[i] === "}") depth--
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as Record<string, unknown>
        } catch {
          break
        }
      }
    }
  }

  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    return null
  }
}
