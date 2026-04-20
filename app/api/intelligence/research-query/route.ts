import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { generateText } from "ai"
import {
  mergeResearchSnippets,
  snippetsFromBriefRows,
  type ResearchEvidenceSnippet,
} from "@/lib/juno/research-evidence"
import { fetchLiveArxivSnippets, fetchLiveWebResearchSnippets } from "@/lib/juno/research-live-fetch"
import { tryParseJsonObject } from "@/lib/parse-llm-json"

export const maxDuration = 120
export const dynamic = "force-dynamic"

type CitedSource = {
  title: string
  url: string
  source: string | null
  relevance_score: number | null
}

const MAX_BRIEF_ROWS = 28
const MERGE_LIMITS = { corpus: 40, arxivLive: 14, webLive: 6 } as const
const MAX_CONTEXT_CHARS = 14_000
/** Rows sent to the LLM (prioritize live retrieval, then scored brief items). */
const MAX_EVIDENCE_FOR_LLM = 34
const MAX_SUMMARY_CHARS = 380

function evidenceOrigin(s: ResearchEvidenceSnippet): "stored_brief" | "live_arxiv" | "live_web" {
  if (s.briefRunAt.startsWith("live_arxiv:")) return "live_arxiv"
  if (s.briefRunAt.startsWith("live_web:")) return "live_web"
  return "stored_brief"
}

function originRank(s: ResearchEvidenceSnippet): number {
  const o = evidenceOrigin(s)
  if (o === "live_arxiv") return 0
  if (o === "live_web") return 1
  return 2
}

function evidenceRowsForModel(merged: ResearchEvidenceSnippet[]): ResearchEvidenceSnippet[] {
  return [...merged]
    .sort((a, b) => {
      const dr = originRank(a) - originRank(b)
      if (dr !== 0) return dr
      return (b.relevanceScore ?? -1) - (a.relevanceScore ?? -1)
    })
    .slice(0, MAX_EVIDENCE_FOR_LLM)
}

function trimContextBlock(block: string): string {
  if (block.length <= MAX_CONTEXT_CHARS) return block
  return `${block.slice(0, MAX_CONTEXT_CHARS)}\n\n…(company context truncated for this request)`
}

/**
 * POST /api/intelligence/research-query
 * Answers from stored daily-brief research items plus live arXiv search and optional Exa web hits.
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

    const body = (await req.json()) as { question?: string }
    const question = body.question?.trim()
    if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 })

    const context = await getCompanyContext(user.id, {
      queryHint: "research papers arxiv agents benchmarks technical standards",
      refreshVault: "if_stale",
    })

    if (context?.scope === "workspace") {
      return NextResponse.json({
        answer:
          "This workspace view does not include your owner-level Signal feed archive. Switch to your main workspace or open the owner dashboard to ask over collected research items.",
        keyFindings: [],
        sources: [],
        evidenceCount: 0,
        storedBriefCount: 0,
        liveArxivCount: 0,
        liveWebCount: 0,
      })
    }

    const boostKeywords = context?.extracted.keywords ?? []

    const [briefRes, arxivLive, webLive] = await Promise.all([
      supabase
        .from("ai_outputs")
        .select("created_at, inputs")
        .eq("user_id", user.id)
        .eq("tool", "daily_brief")
        .order("created_at", { ascending: false })
        .limit(MAX_BRIEF_ROWS),
      fetchLiveArxivSnippets(question, boostKeywords, 14).catch((e) => {
        console.error("[research-query] live arXiv:", e)
        return [] as ResearchEvidenceSnippet[]
      }),
      fetchLiveWebResearchSnippets(question, 6).catch((e) => {
        console.error("[research-query] live web:", e)
        return [] as ResearchEvidenceSnippet[]
      }),
    ])

    if (briefRes.error) {
      console.error("[research-query] ai_outputs:", briefRes.error.message)
    }

    const corpus = snippetsFromBriefRows(briefRes.data ?? [], 80)

    const merged = mergeResearchSnippets(corpus, arxivLive, webLive, {
      corpus: MERGE_LIMITS.corpus,
      arxivLive: MERGE_LIMITS.arxivLive,
      webLive: MERGE_LIMITS.webLive,
    })

    const storedBriefCount = merged.filter((s) => evidenceOrigin(s) === "stored_brief").length
    const liveArxivCount = merged.filter((s) => evidenceOrigin(s) === "live_arxiv").length
    const liveWebCount = merged.filter((s) => evidenceOrigin(s) === "live_web").length

    if (merged.length === 0) {
      return NextResponse.json({
        answer:
          "No research evidence is available yet. Save company keywords on your profile, let at least one daily brief run, and try again. Live arXiv search also returned no hits for this phrasing (try shorter nouns or acronyms).",
        keyFindings: [],
        sources: [],
        evidenceCount: 0,
        storedBriefCount: 0,
        liveArxivCount: 0,
        liveWebCount: 0,
      })
    }

    const forModel = evidenceRowsForModel(merged)

    const contextBlock = context?.promptBlock
      ? `OUR COMPANY / CONTEXT:\n${trimContextBlock(context.promptBlock)}\n\n`
      : ""

    const prompt = `You are a research analyst answering a question using mixed evidence: items from the founder's saved daily briefs, freshly retrieved arXiv results for this question, and optional open-web snippets.

${contextBlock}QUESTION:
"${question}"

EVIDENCE (${forModel.length} of ${merged.length} gathered items; highest priority first). Each row includes evidenceOrigin:
- stored_brief: scored when a past daily brief ran
- live_arxiv: retrieved just now from arXiv for this question
- live_web: retrieved just now from the web (when available)

${JSON.stringify(
  forModel.map((s: ResearchEvidenceSnippet) => ({
    evidenceOrigin: evidenceOrigin(s),
    url: s.url,
    title: s.title,
    source: s.source,
    abstractOrSummary: s.description.slice(0, MAX_SUMMARY_CHARS),
    publishedAt: s.publishedAt,
    relevanceScore: s.relevanceScore,
    category: s.category,
    whyItMatters: s.whyItMatters.slice(0, 240),
    strategicImplication: s.strategicImplication.slice(0, 240),
    briefRunAt: s.briefRunAt,
  })),
  null,
  2,
)}

TASK:
Answer the question directly. Ground specific claims in the URLs above. Prefer live_arxiv or live_web when they directly address the question; use stored_brief for founder-specific scoring context when relevant.

If nothing in the set answers the core question, say that plainly and summarize the closest related points.

Distinguish established definitions from opinion. Note disagreements when sources conflict.

Return JSON with this exact shape:
{
  "answer": "4-10 sentences",
  "keyFindings": ["bullet 1", "bullet 2", "bullet 3"],
  "citedUrls": ["url1", "url2"]
}

citedUrls must be URLs from EVIDENCE you relied on.

Return ONLY valid JSON, no markdown fences.`

    let text: string
    try {
      const out = await generateText({
        model: qwenModel(),
        maxOutputTokens: 2200,
        messages: [{ role: "user", content: appendWritingRules(prompt) }],
      })
      text = out.text
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr)
      console.error("[research-query] LLM:", llmErr)
      return NextResponse.json(
        {
          error:
            msg.length > 0 && msg.length < 400
              ? msg
              : "The language model request failed. Check API keys and quotas, then try again.",
        },
        { status: 502 },
      )
    }

    const parsed = tryParseJsonObject<{
      answer?: string
      keyFindings?: string[]
      citedUrls?: string[]
    }>(text)

    let answer = typeof parsed?.answer === "string" ? parsed.answer.trim() : ""
    let keyFindings = Array.isArray(parsed?.keyFindings)
      ? parsed.keyFindings.filter((x): x is string => typeof x === "string")
      : []

    if (!answer) {
      const fallback = text?.trim().slice(0, 2500) ?? ""
      answer =
        fallback.length > 80
          ? `Model output was not valid JSON. Raw reply (trimmed):\n\n${fallback}`
          : "The model returned an empty or unreadable reply. Try again with a shorter question."
      keyFindings = []
    }

    const citedUrls = new Set(
      (Array.isArray(parsed?.citedUrls) ? parsed.citedUrls : [])
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim()),
    )
    const citedSources: CitedSource[] = merged
      .filter((s) => citedUrls.has(s.url))
      .map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source || null,
        relevance_score: s.relevanceScore,
      }))

    return NextResponse.json({
      answer,
      keyFindings,
      sources: citedSources,
      evidenceCount: merged.length,
      storedBriefCount,
      liveArxivCount,
      liveWebCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[research-query] error:", err)
    return NextResponse.json(
      {
        error:
          message && message.length < 500
            ? message
            : "Query failed — try again.",
      },
      { status: 500 },
    )
  }
}
