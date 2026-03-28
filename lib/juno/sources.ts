export interface Source {
  url: string
  name: string
  category: "startup" | "ai_research" | "ai_industry" | "regulation" | "vc" | "jobs"
  agents: Array<"cbs" | "cro" | "cmo" | "cto">
  type: "rss" | "api"
}

export const SOURCES: Source[] = [
  {
    url: "https://techcrunch.com/feed/",
    name: "TechCrunch",
    category: "startup",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://news.crunchbase.com/feed/",
    name: "Crunchbase News",
    category: "startup",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://www.producthunt.com/feed",
    name: "Product Hunt",
    category: "startup",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://www.saastr.com/feed/",
    name: "SaaStr",
    category: "startup",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://news.ycombinator.com/rss",
    name: "Hacker News",
    category: "startup",
    agents: ["cbs", "cto"],
    type: "rss",
  },
  {
    url: "https://huggingface.co/blog/feed.xml",
    name: "Hugging Face",
    category: "ai_research",
    agents: ["cto"],
    type: "rss",
  },
  {
    url: "https://www.anthropic.com/blog/rss.xml",
    name: "Anthropic",
    category: "ai_industry",
    agents: ["cto", "cbs"],
    type: "rss",
  },
  {
    url: "https://openai.com/blog/rss.xml",
    name: "OpenAI",
    category: "ai_industry",
    agents: ["cto", "cbs"],
    type: "rss",
  },
  {
    url: "https://blog.google/technology/ai/rss/",
    name: "Google AI",
    category: "ai_industry",
    agents: ["cto"],
    type: "rss",
  },
  {
    url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml",
    name: "The Verge AI",
    category: "ai_industry",
    agents: ["cto", "cbs"],
    type: "rss",
  },
  {
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    name: "Ars Technica",
    category: "ai_industry",
    agents: ["cto"],
    type: "rss",
  },
  {
    url: "https://artificialintelligenceact.eu/feed/",
    name: "EU AI Act",
    category: "regulation",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://iapp.org/news/rss/",
    name: "IAPP Privacy",
    category: "regulation",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://a16z.com/feed/",
    name: "a16z",
    category: "vc",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://www.ycombinator.com/blog/feed/",
    name: "Y Combinator",
    category: "vc",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://www.sequoiacap.com/feed/",
    name: "Sequoia Capital",
    category: "vc",
    agents: ["cbs"],
    type: "rss",
  },
  {
    url: "https://remotive.com/remote-jobs/feed",
    name: "Remotive Jobs",
    category: "jobs",
    agents: ["cro"],
    type: "rss",
  },
]

export function getSourcesForAgent(agent: "cbs" | "cro" | "cmo" | "cto"): Source[] {
  return SOURCES.filter((s) => s.agents.includes(agent))
}

export function getSourcesByCategory(category: Source["category"]): Source[] {
  return SOURCES.filter((s) => s.category === category)
}
