import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { generateText } from "ai"
import { snippetsFromBriefRows, type ResearchEvidenceSnippet } from "@/lib/juno/research-evidence"

export const maxDuration = 60
export const dynamic = "force-dynamic"

type CitedSource = {
  title: string
  url: string
  source: string | null
  relevance_score: number | null
}

const MAX_BRIEF_ROWS = 28
const MAX_EVIDENCE = 72

/**
 * POST /api/intelligence/research-query
 * Answers questions using research-class items from recent daily briefs (arXiv, papers, etc.).
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
      })
    }

    const { data: briefRows } = await supabase
      .from("ai_outputs")
      .select("created_at, inputs")
      .eq("user_id", user.id)
      .eq("tool", "daily_brief")
      .order("created_at", { ascending: false })
      .limit(MAX_BRIEF_ROWS)

    const evidence = snippetsFromBriefRows(briefRows ?? [], MAX_EVIDENCE)

    if (evidence.length === 0) {
      return NextResponse.json({
        answer:
          "No research items are stored in your recent daily briefs yet. Once the CBS brief runs (scheduled around 05:00) with your company profile and keywords set, Juno ingests arXiv and similar sources and scores them into the Research section of your Signal feed — then you can ask over that corpus.",
        keyFindings: [],
        sources: [],
        evidenceCount: 0,
      })
    }

    const contextBlock = context?.promptBlock ? `OUR COMPANY / CONTEXT:\n${context.promptBlock}\n\n` : ""

    const prompt = `You are a research analyst answering a question using evidence from curated research signals (papers, preprints, and technical summaries) collected for this founder.

${contextBlock}QUESTION:
"${question}"

RESEARCH SIGNALS (${evidence.length} items — titles, sources, and why they mattered when scored):
${JSON.stringify(
  evidence.map((s: ResearchEvidenceSnippet) => ({
    url: s.url,
    title: s.title,
    source: s.source,
    abstractOrSummary: s.description,
    publishedAt: s.publishedAt,
    relevanceScore: s.relevanceScore,
    category: s.category,
    whyItMatters: s.whyItMatters,
    strategicImplication: s.strategicImplication,
    collectedFromBriefRun: s.briefRunAt,
  })),
  null,
  2,
)}

TASK:
Answer the question directly. Ground every substantive claim in the items above. If the evidence does not contain enough detail to answer (for example the question is highly specific and no item discusses it), say so clearly and still report what the corpus does support.

Use careful academic-style language: distinguish established definitions from speculation. If items conflict, note the disagreement.

Return JSON with this exact shape:
{
  "answer": "4-8 sentences",
  "keyFindings": ["bullet 1", "bullet 2", "bullet 3"],
  "citedUrls": ["url1", "url2"]
}

citedUrls must be a subset of the urls in RESEARCH SIGNALS that you relied on most.

Return ONLY valid JSON, no markdown fences.`

    const { text } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 1800,
      messages: [{ role: "user", content: appendWritingRules(prompt) }],
    })

    const parsed = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      answer?: string
      keyFindings?: string[]
      citedUrls?: string[]
    }

    const citedUrls = new Set((parsed.citedUrls ?? []).map((u) => u.trim()))
    const citedSources: CitedSource[] = evidence
      .filter((s) => citedUrls.has(s.url))
      .map((s) => ({
        title: s.title,
        url: s.url,
        source: s.source || null,
        relevance_score: s.relevanceScore,
      }))

    return NextResponse.json({
      answer: parsed.answer ?? "",
      keyFindings: parsed.keyFindings ?? [],
      sources: citedSources,
      evidenceCount: evidence.length,
    })
  } catch (err) {
    console.error("[research-query] error:", err)
    return NextResponse.json({ error: "Query failed — try again." }, { status: 500 })
  }
}
