import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isProduction } from "@/lib/api-error-response"
import { generateText } from "ai"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContext } from "@/lib/company-context"
import { fetchContextualNewsItems, type AuditRawItem } from "@/lib/content-intelligence/audit-ai-sources"

function buildDigestSystemPrompt(params: {
  companyName: string
  industry: string
  vertical: string
  icp: string
}): string {
  const { companyName, industry, vertical, icp } = params
  return `You are an investigative journalist writing a magazine feature on how AI is reshaping ${industry || vertical || "the technology industry"}. Your reader is a founder at ${companyName || "a startup"} selling to ${icp || "B2B buyers"}.

You will receive a batch of raw signals (news, articles) from the last 45 days relevant to this market.

Produce a single JSON object with these fields:

headline (string): Magazine cover headline. Punchy, factual, names real companies and figures.
subhead (string): One sentence expanding on headline.
executiveSummary (string): 3-4 paragraph magazine lede. Tell the full arc: who moved, what happened, why it matters for this market. Name specific companies, regulators, or investors where they appear.
timeline (array of objects): Chronological events, each with date (ISO string or "recent"), actor (company/org name), event (what happened, under 200 chars), significance (why it matters for ${companyName || "this startup"}, under 300 chars), sourceUrl (string or null).
firmProfiles (array of objects): Per-company breakdown with name, stance (their position on AI), moves (specific actions taken), quote (verbatim quote if available, else null), assessment (analyst judgment on where they stand).
marketImplications (string): What this means for buyers, builders, and sellers of ${industry || vertical || "technology"} products.
whatToWatch (array of strings): 5-8 specific things to monitor in the next 90 days that directly affect ${companyName || "this company"}'s market.
rawSourceCount (number): How many raw items you were given.

Be direct. Use names, numbers, dates. Skip filler. Tailor every insight to a founder in the ${industry || vertical || "technology"} space.`
}

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const context = await getCompanyContext(auth.user.id, { useCookieOrganization: true })
  const orgId = context?.organizationId ?? auth.user.id
  const cacheKey = `market-digest:${orgId}`

  const { data: cached } = await supabase
    .from("content_briefings")
    .select("id, summary, generated_at")
    .eq("user_id", auth.user.id)
    .like("id", `market-digest:${orgId}%`)
    .order("generated_at", { ascending: false })
    .limit(1)

  if (cached && cached.length > 0) {
    const age = Date.now() - new Date(cached[0].generated_at).getTime()
    if (age < 6 * 60 * 60 * 1000) {
      try {
        const parsed = JSON.parse(cached[0].summary)
        return NextResponse.json({
          digest: parsed,
          cached: true,
          generatedAt: cached[0].generated_at,
          companyName: context?.profile.name ?? "",
          industry: context?.profile.industry ?? "",
        })
      } catch {
        // stale or corrupt, fall through to regenerate
      }
    }
  }

  return NextResponse.json({
    digest: null,
    cached: false,
    message: "Use POST to generate a fresh digest.",
    companyName: context?.profile.name ?? "",
    industry: context?.profile.industry ?? "",
  })
}

export async function POST() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: "LLM not configured" }, { status: 500 })
  }

  const context = await getCompanyContext(auth.user.id, { useCookieOrganization: true })
  const companyName = context?.profile.name?.trim() || "My Company"
  const industry = context?.profile.industry?.trim() || context?.extracted.vertical?.trim() || "technology"
  const vertical = context?.extracted.vertical?.trim() || industry
  const icp = [...(context?.profile.icp ?? []), ...(context?.extracted.icp ?? [])]
    .filter(Boolean)
    .slice(0, 4)
    .join(", ")
  const keywords = context?.extracted.keywords ?? []
  const competitors = context?.extracted.competitors ?? []

  const items = await fetchContextualNewsItems({
    companyName,
    industry,
    vertical,
    keywords,
    competitors,
  })

  if (items.length === 0) {
    return NextResponse.json({
      digest: null,
      error: `No market signals found for ${companyName} in the last 45 days. Try again later.`,
    })
  }

  const LLM_ITEM_CAP = 72
  const itemsForLlm = items.slice(0, LLM_ITEM_CAP)
  const systemPrompt = buildDigestSystemPrompt({ companyName, industry, vertical, icp })
  const userPayload = buildUserPayload(itemsForLlm, items.length, companyName)

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(systemPrompt),
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

    const orgId = context?.organizationId ?? auth.user.id
    const briefingId = `market-digest:${orgId}:${Date.now()}`
    const { error: persistError } = await supabase.from("content_briefings").upsert(
      {
        id: briefingId,
        user_id: auth.user.id,
        generated_at: new Date().toISOString(),
        angle: `45 days of AI in ${industry} — ${companyName}`,
        summary: JSON.stringify(digest),
        top_hook: digest.headline ?? `AI in ${industry}`,
        connections: [],
        story_count: items.length,
        breaking_count: 0,
      },
      { onConflict: "id" },
    )
    if (persistError) {
      console.error("[market-digest] content_briefings upsert:", persistError.message)
    }

    return NextResponse.json({
      digest,
      cached: false,
      generatedAt: new Date().toISOString(),
      sourceCount: items.length,
      companyName,
      industry,
    })
  } catch (e) {
    console.error("[market-digest] Generation failed:", e)
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

function buildUserPayload(items: AuditRawItem[], totalFetched: number, companyName: string): string {
  const sorted = [...items].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  )

  const lines = sorted.map((item, i) => {
    const date = new Date(item.publishedAt).toISOString().slice(0, 10)
    const snippet =
      item.snippet.length > SNIPPET_MAX ? `${item.snippet.slice(0, SNIPPET_MAX)}…` : item.snippet
    return `[${i}] date: ${date}\ntitle: ${item.title}\nsource: ${item.source}\nurl: ${item.url}\nauthor: ${item.author ?? "unknown"}\nsnippet: ${snippet}`
  })

  const capNote =
    items.length < totalFetched
      ? ` (showing ${items.length} of ${totalFetched} fetched)`
      : ""

  return `Below are ${items.length} raw market signals from the last 45 days relevant to ${companyName}${capNote}. Synthesize them into the magazine feature format.\n\n${lines.join("\n\n")}`
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : text.trim()

  const start = candidate.indexOf("{")
  if (start === -1) return null

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

  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    return null
  }
}
