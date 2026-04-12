import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { generateText } from "ai"

export const maxDuration = 60
export const dynamic = "force-dynamic"

type CitedThread = {
  title: string
  url: string
  subreddit: string | null
  relevance_score: number | null
}

/**
 * POST /api/intelligence/behavioral-query
 * Searches stored Reddit intent_signals with an arbitrary user question
 * and synthesizes an answer from the evidence.
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

    const [context, { data: signals }] = await Promise.all([
      getCompanyContext(user.id, {
        queryHint: "reddit customer research buying process pain points",
        refreshVault: "if_stale",
        useCookieWorkspace: true,
      }),
      supabase
        .from("intent_signals")
        .select("id, title, body, url, subreddit, why_relevant, relevance_score, signal_type, discovered_at")
        .eq("user_id", user.id)
        .eq("platform", "reddit")
        .order("relevance_score", { ascending: false })
        .limit(60),
    ])

    if (!signals || signals.length === 0) {
      return NextResponse.json({
        answer: "No Reddit conversations are stored yet. Run a Reddit scan first to build up the evidence base.",
        threads: [],
      })
    }

    const contextBlock = context?.promptBlock
      ? `OUR COMPANY:\n${context.promptBlock}\n\n`
      : ""

    const prompt = `You are a customer research analyst answering a specific question using evidence from Reddit conversations.

${contextBlock}QUESTION:
"${question}"

REDDIT CONVERSATIONS (${signals.length} threads, ordered by relevance score):
${JSON.stringify(
  signals.map((s) => ({
    url: s.url,
    title: s.title,
    body: typeof s.body === "string" ? s.body.slice(0, 400) : null,
    subreddit: s.subreddit,
    why_relevant: s.why_relevant,
    relevance_score: s.relevance_score,
    signal_type: s.signal_type,
  })),
  null,
  2,
)}

TASK:
Answer the question directly and specifically using the conversations above as evidence. Cite which threads support your answer. Be analytical and concrete — not generic.

Return JSON with this exact shape:
{
  "answer": "3-6 sentences directly answering the question with specific evidence from the threads",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "citedUrls": ["url1", "url2", "url3"]
}

Return ONLY valid JSON, no markdown fences.`

    const { text } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 1500,
      messages: [{ role: "user", content: appendWritingRules(prompt) }],
    })

    const parsed = JSON.parse(text?.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      answer?: string
      keyFindings?: string[]
      citedUrls?: string[]
    }

    const citedUrls = new Set((parsed.citedUrls ?? []).map((u) => u.trim()))
    const citedThreads: CitedThread[] = signals
      .filter((s) => citedUrls.has(s.url))
      .map((s) => ({
        title: s.title,
        url: s.url,
        subreddit: s.subreddit ?? null,
        relevance_score: s.relevance_score ?? null,
      }))

    return NextResponse.json({
      answer: parsed.answer ?? "",
      keyFindings: parsed.keyFindings ?? [],
      threads: citedThreads,
      signalsSearched: signals.length,
    })
  } catch (err) {
    console.error("[behavioral-query] error:", err)
    return NextResponse.json({ error: "Query failed — try again." }, { status: 500 })
  }
}
