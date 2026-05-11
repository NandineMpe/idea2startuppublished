import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"
import { fetchRecentArxivPapers } from "@/lib/careeros/sources/arxiv-feed"
import { fetchRecentAnthropicNews } from "@/lib/careeros/sources/anthropic-news"
import { fetchRecentOpenAiNews } from "@/lib/careeros/sources/openai-news"
import { fetchRecentDeepMindBlog } from "@/lib/careeros/sources/deepmind-blog"
import { fetchRecentMetaAiBlog } from "@/lib/careeros/sources/meta-ai-blog"
import { fetchRecentHuggingFacePapers } from "@/lib/careeros/sources/huggingface-papers"
import { fetchRecentPapersWithCode } from "@/lib/careeros/sources/papers-with-code"
import { fetchRecentHackerNews } from "@/lib/careeros/sources/hacker-news"
import { fetchRecentGithubTrending } from "@/lib/careeros/sources/github-trending"
import { fetchRecentPragmaticEngineer } from "@/lib/careeros/sources/pragmatic-engineer"
import { fetchRecentTechCrunchAi } from "@/lib/careeros/sources/techcrunch-ai"
import { fetchRecentMicrosoftResearchBlog } from "@/lib/careeros/sources/microsoft-research-blog"
import { fetchRecentMistralNews } from "@/lib/careeros/sources/mistral-news"
import { fetchRecentEleutherAiBlog } from "@/lib/careeros/sources/eleutherai-blog"

export const FEED_SOURCE_KEYS = [
  "arxiv",
  "anthropic-news",
  "openai-news",
  "deepmind-blog",
  "meta-ai-blog",
  "huggingface-papers",
  "papers-with-code",
  "hacker-news",
  "github-trending",
  "pragmatic-engineer",
  "techcrunch-ai",
  "microsoft-research-blog",
  "mistral-news",
  "eleutherai-blog",
] as const

export type FeedSourceKey = (typeof FEED_SOURCE_KEYS)[number]

const FEED_FETCHERS: Record<FeedSourceKey, (hoursBack: number) => Promise<RawFeedItem[]>> = {
  arxiv: fetchRecentArxivPapers,
  "anthropic-news": fetchRecentAnthropicNews,
  "openai-news": fetchRecentOpenAiNews,
  "deepmind-blog": fetchRecentDeepMindBlog,
  "meta-ai-blog": fetchRecentMetaAiBlog,
  "huggingface-papers": fetchRecentHuggingFacePapers,
  "papers-with-code": fetchRecentPapersWithCode,
  "hacker-news": fetchRecentHackerNews,
  "github-trending": fetchRecentGithubTrending,
  "pragmatic-engineer": fetchRecentPragmaticEngineer,
  "techcrunch-ai": fetchRecentTechCrunchAi,
  "microsoft-research-blog": fetchRecentMicrosoftResearchBlog,
  "mistral-news": fetchRecentMistralNews,
  "eleutherai-blog": fetchRecentEleutherAiBlog,
}

export async function fetchFromSource(source: FeedSourceKey, hoursBack: number) {
  return FEED_FETCHERS[source](hoursBack)
}
