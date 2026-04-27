import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isProduction } from "@/lib/api-error-response"
import { generateText } from "ai"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { getCompanyContext } from "@/lib/company-context"
import { fetchContextualNewsItems, type AuditRawItem } from "@/lib/content-intelligence/audit-ai-sources"

export const maxDuration = 180

function buildDigestSystemPrompt(params: {
  companyName: string
  industry: string
  vertical: string
  icp: string
  companyContext: string
}): string {
  const { companyName, industry, vertical, icp, companyContext } = params
  return `You are the editor of an industry alignment document for accounting and auditing. Your job is to compile the canonical 45-day state-of-the-industry memo: if a founder, audit partner, regulator, CFO, controller, or product leader reads this document, they should understand the material changes without needing to read the underlying news cycle first.

Your reader is a founder at ${companyName || "a startup"} selling to ${icp || "B2B buyers"} in ${industry || vertical || "the accounting and audit market"}.

COMPANY CONTEXT:
${companyContext || "No detailed company context available. Use accounting/auditing relevance as the default filter."}

You will receive raw signals from the last 45 days. They were gathered from broad accounting/audit searches plus company-context searches. Be comprehensive, but be disciplined: include every item that affects accounting, audit, assurance, financial reporting, audit quality, accounting standards, SEC/PCAOB/FASB/AICPA activity, CFO/controller workflows, audit firm economics, talent/training, university/accounting education, or AI/software used in audit and accounting. Down-rank generic business/tech items that do not connect back to those areas.

The final document must feel like an analyst desk has done the work: group related developments, name who moved, explain what changed from the previous state, and make clear what the industry now needs to believe or watch.

Produce a single JSON object with these fields:

headline (string): Direct factual headline for the whole 45-day accounting/audit cycle.
subhead (string): One sentence expanding on headline.
executiveSummary (string): 5-8 paragraph state-of-the-industry brief. Cover the full arc across regulation, standards, firm/vendor moves, audit quality, technology, education/training, workforce economics, and buyer implications.
industryAlignmentMemo (string): The main document. Write this as a structured memo with short section headings in plain text. It must explain the current state, the changes over the last 45 days, the implications, and what an informed operator should now do or believe. This is the "read this and you are caught up" section.
stateOfPlay (array of objects): 6-10 entries with theme, whatChanged, whyItMatters, whoIsAffected, sourceUrls.
changeLog (array of objects): Every material change you can identify, with date, category ("regulation"|"audit_quality"|"firm_economics"|"technology"|"education_training"|"standards"|"enforcement"|"market"), actor, change, impact, sourceUrl.
mustKnowHeadlines (array of objects): 12-25 important items with date, title, source, whyItMatters, companyRelevance, sourceUrl.
timeline (array of objects): Chronological events, each with date (ISO string or "recent"), actor (company/org/regulator), event (what happened, under 220 chars), significance (why it matters for ${companyName || "this startup"}, under 350 chars), sourceUrl (string or null).
firmProfiles (array of objects): Per-company/vendor/firm breakdown with name, stance, moves, quote (verbatim quote if available, else null), assessment.
regulatoryLandscape (string): SEC, PCAOB, FASB, AICPA, IFRS/IASB, tax, assurance, enforcement, and audit-quality developments that matter.
technologyLandscape (string): AI, automation, audit tools, accounting software, data/controls, and workflow technology developments.
educationAndWorkforceLandscape (string): Accounting education, university training, AI simulation/training, hiring, promotions/demotions, partner economics, staffing, and talent-model developments.
marketImplications (string): What this means for buyers, builders, sellers, auditors, CFOs/controllers, universities, and audit/accounting software companies.
riskAndOpportunityMap (array of objects): 6-12 entries with theme, risk, opportunity, whoShouldCare.
stakeholderBriefings (array of objects): For each stakeholder type ("audit_firm_leaders","audit_partners","cfo_controllers","regulators","students_universities","software_builders","founders"), give nowTrue, implication, action.
whatToWatch (array of strings): 8-12 specific things to monitor in the next 90 days that directly affect ${companyName || "this company"}'s market.
sourceRegister (array of objects): Every relevant raw item you used, with date, title, source, sourceUrl, relevanceTier ("critical"|"important"|"watch"), and one-line reason. Include lower-tier but still relevant items here so the user sees breadth.
coverageNotes (string): Explain what the source set covers and any likely blind spots.
rawSourceCount (number): How many raw items you were given.

Rules:
- Do not hallucinate facts beyond the supplied items.
- If multiple items are near-duplicates, consolidate them in the narrative but keep representative entries in sourceRegister.
- Prefer specificity over drama. Use names, numbers, dates, and source URLs.
- Tailor every implication to ${companyName || "this company"} and its company context.
- If a supplied item is irrelevant, exclude it from mustKnowHeadlines and sourceRegister unless it explains a blind spot.
- Do not write a shallow digest. If the source set includes audit-firm economics, education/training, regulation, technology, and audit quality, each of those areas must appear in the memo.
- Treat partner demotions, audit workforce changes, regulator AI guidance, university AI simulation/training, and audit quality enforcement as first-class industry changes, not side notes.
- Return JSON only.`
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
  const companyContext = (context?.promptBlock ?? "").slice(0, 12_000)

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

  const LLM_ITEM_CAP = 160
  const itemsForLlm = items.slice(0, LLM_ITEM_CAP)
  const systemPrompt = buildDigestSystemPrompt({ companyName, industry, vertical, icp, companyContext })
  const userPayload = buildUserPayload(itemsForLlm, items.length, companyName)

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(systemPrompt),
      prompt: userPayload,
      maxOutputTokens: 16000,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(165_000),
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
        angle: `45 days of accounting and audit intelligence - ${companyName}`,
        summary: JSON.stringify(digest),
        top_hook: digest.headline ?? `Accounting and audit intelligence for ${industry}`,
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

const SNIPPET_MAX = 650

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

  return `Below are ${items.length} raw accounting/auditing market signals from the last 45 days relevant to ${companyName}${capNote}.

Your task:
1. Identify every item that matters to accounting, auditing, financial reporting, audit quality, accounting standards, SEC/PCAOB/FASB/AICPA activity, CFO/controller workflows, or AI/accounting software.
2. Synthesize the big story.
3. Preserve breadth in sourceRegister so the user can inspect the long tail of relevant headlines and reports.
4. Connect the findings to ${companyName}'s company context and market.

RAW SIGNALS:

${lines.join("\n\n")}`
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
