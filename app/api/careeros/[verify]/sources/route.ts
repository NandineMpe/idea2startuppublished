import { NextResponse } from "next/server"
import { pingONet } from "@/lib/careeros/sources/onet"
import { pingCareerOneStop } from "@/lib/careeros/sources/careeronestop"
import { pingAdzuna } from "@/lib/careeros/sources/adzuna"
import { pingJSearch } from "@/lib/careeros/sources/jsearch"
import { pingBls } from "@/lib/careeros/sources/bls"
import { pingEurostat } from "@/lib/careeros/sources/eurostat"
import { pingCsoIreland } from "@/lib/careeros/sources/cso-ireland"
import { pingLevelsFyi } from "@/lib/careeros/sources/levelsfyi"
import { pingSecEdgar } from "@/lib/careeros/sources/sec-edgar"
import { pingArxiv } from "@/lib/careeros/sources/arxiv"
import { pingLayoffsFyi } from "@/lib/careeros/sources/layoffs-fyi"
import { pingArxivFeed } from "@/lib/careeros/sources/arxiv-feed"
import { pingAnthropicNews } from "@/lib/careeros/sources/anthropic-news"
import { pingOpenAiNews } from "@/lib/careeros/sources/openai-news"
import { pingDeepMindBlog } from "@/lib/careeros/sources/deepmind-blog"
import { pingMetaAiBlog } from "@/lib/careeros/sources/meta-ai-blog"
import { pingHuggingFacePapers } from "@/lib/careeros/sources/huggingface-papers"
import { pingPapersWithCode } from "@/lib/careeros/sources/papers-with-code"
import { pingHackerNews } from "@/lib/careeros/sources/hacker-news"
import { pingGithubTrending } from "@/lib/careeros/sources/github-trending"
import { pingPragmaticEngineer } from "@/lib/careeros/sources/pragmatic-engineer"
import { pingTechCrunchAi } from "@/lib/careeros/sources/techcrunch-ai"
import { pingMicrosoftResearchBlog } from "@/lib/careeros/sources/microsoft-research-blog"
import { pingMistralNews } from "@/lib/careeros/sources/mistral-news"
import { pingEleutherAiBlog } from "@/lib/careeros/sources/eleutherai-blog"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type PingFn = () => Promise<unknown>

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const adapters: Array<[string, PingFn]> = [
    ["onet", pingONet],
    ["careeronestop", pingCareerOneStop],
    ["adzuna", pingAdzuna],
    ["jsearch", pingJSearch],
    ["bls", pingBls],
    ["eurostat", pingEurostat],
    ["cso-ireland", pingCsoIreland],
    ["levelsfyi", pingLevelsFyi],
    ["sec-edgar", pingSecEdgar],
    ["arxiv", pingArxiv],
    ["layoffs-fyi", pingLayoffsFyi],
    ["feed-arxiv", pingArxivFeed],
    ["feed-anthropic-news", pingAnthropicNews],
    ["feed-openai-news", pingOpenAiNews],
    ["feed-deepmind-blog", pingDeepMindBlog],
    ["feed-meta-ai-blog", pingMetaAiBlog],
    ["feed-huggingface-papers", pingHuggingFacePapers],
    ["feed-papers-with-code", pingPapersWithCode],
    ["feed-hacker-news", pingHackerNews],
    ["feed-github-trending", pingGithubTrending],
    ["feed-pragmatic-engineer", pingPragmaticEngineer],
    ["feed-techcrunch-ai", pingTechCrunchAi],
    ["feed-microsoft-research-blog", pingMicrosoftResearchBlog],
    ["feed-mistral-news", pingMistralNews],
    ["feed-eleutherai-blog", pingEleutherAiBlog],
  ]

  const results: Record<string, unknown> = {}
  for (const [name, ping] of adapters) {
    try {
      results[name] = await ping()
    } catch (err) {
      results[name] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  const allOk = Object.values(results).every((r) => {
    if (!r || typeof r !== "object") return false
    return (r as { ok?: unknown }).ok === true
  })

  return NextResponse.json({
    overall: allOk ? "PASS" : "FAIL",
    timestamp: new Date().toISOString(),
    adapters: results,
  })
}
