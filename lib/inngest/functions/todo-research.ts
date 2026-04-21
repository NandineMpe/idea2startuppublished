/**
 * Todo Research: when a user adds a custom todo, this function runs deep research
 * on the topic — crawls relevant URLs, surfaces key findings, action items, and sources.
 * Results are stored in `todo_research` and surfaced back in the todo UI.
 */
import { generateText } from "ai"
import { inngest } from "@/lib/inngest/client"
import { mergeSystemWithWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { getCompanyContext } from "@/lib/company-context"
import { supabaseAdmin } from "@/lib/supabase"
import { TODO_RESEARCH_REQUESTED } from "@/lib/inngest/event-names"

type ResearchOutput = {
  summary: string
  keyFindings: string[]
  actionItems: string[]
  sources: Array<{ title: string; url: string; relevance: string }>
}

// URLs to probe for common startup program / application types
const KNOWN_APPLICATION_URLS: Record<string, string[]> = {
  "solo founder": [
    "https://www.ycombinator.com/apply",
    "https://www.founder.university",
    "https://founders.google.com/intl/en_us/programs",
  ],
  "y combinator": ["https://www.ycombinator.com/apply"],
  "techstars": ["https://www.techstars.com/apply"],
  "500 startups": ["https://500.co/accelerators"],
  "grant": ["https://www.sbir.gov", "https://opportunity.census.gov"],
}

function detectKnownUrls(todoText: string): string[] {
  const lower = todoText.toLowerCase()
  for (const [keyword, urls] of Object.entries(KNOWN_APPLICATION_URLS)) {
    if (lower.includes(keyword)) return urls
  }
  return []
}

async function fetchPageSnippet(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "JunoResearch/1.0" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ""
    const html = await res.text()
    // Strip HTML tags and collapse whitespace, take first 2000 chars
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000)
  } catch {
    return ""
  }
}

async function researchTodo(
  todoText: string,
  companyContext: string,
): Promise<ResearchOutput> {
  if (!isLlmConfigured()) {
    return {
      summary: "LLM not configured — set OPENROUTER_API_KEY (or LLM_API_KEY) to enable research.",
      keyFindings: [],
      actionItems: [],
      sources: [],
    }
  }

  // Crawl any known application pages to ground the research
  const knownUrls = detectKnownUrls(todoText)
  const pageSnippets = await Promise.all(knownUrls.map(fetchPageSnippet))
  const pageContext = knownUrls
    .map((url, i) => (pageSnippets[i] ? `\n\n## Page: ${url}\n${pageSnippets[i]}` : ""))
    .filter(Boolean)
    .join("")

  const system = `You are a world-class research assistant helping a B2B SaaS founder.
Given a task description and optional company context, produce a comprehensive research brief.

Return ONLY valid JSON matching this shape exactly:
{
  "summary": "2-3 sentence executive summary of the research",
  "keyFindings": ["finding 1", "finding 2", ...],
  "actionItems": ["specific action 1", "specific action 2", ...],
  "sources": [{"title": "...", "url": "...", "relevance": "..."}]
}

Rules:
- keyFindings: 4-8 concrete facts, insights, or patterns discovered. Specific > vague.
- actionItems: 3-6 ordered steps the founder should take. Include application tips, how to stand out, what evaluators look for.
- sources: list the most credible URLs/references relevant to this task (real URLs only).
- If the task involves applying to a program (accelerator, grant, fellowship), be extremely specific about criteria, what they look for, and how to write a standout application.
- If the task involves outreach or sales, extract specific buyer sentiment patterns and what works.`

  const prompt = `Task to research: "${todoText}"

Company context:
${companyContext || "Not provided"}
${pageContext ? `\nPage content crawled from known sources:${pageContext}` : ""}

Produce a thorough research brief for this task.`

  try {
    const { text } = await generateText({
      model: qwenModel(),
      system: mergeSystemWithWritingRules(system),
      prompt,
      maxOutputTokens: 3000,
      temperature: 0.3,
    })

    const cleaned = text.replace(/```json|```/gi, "").trim()
    let parsed: ResearchOutput
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const start = cleaned.indexOf("{")
      const end = cleaned.lastIndexOf("}")
      if (start >= 0 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1))
      } else {
        throw new Error("No JSON found in response")
      }
    }

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings.filter((f) => typeof f === "string") : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter((a) => typeof a === "string") : [],
      sources: Array.isArray(parsed.sources)
        ? parsed.sources.filter((s) => s && typeof s.title === "string" && typeof s.url === "string")
        : [],
    }
  } catch (e) {
    console.warn("[todo-research] LLM failed:", e)
    return {
      summary: "Research could not be completed — try again shortly.",
      keyFindings: [],
      actionItems: [],
      sources: [],
    }
  }
}

export const todoResearch = inngest.createFunction(
  {
    id: "todo-research",
    name: "Todo: Deep Research on new task",
    triggers: [{ event: TODO_RESEARCH_REQUESTED }],
    concurrency: { limit: 3 },
    retries: 1,
  },
  async ({ event, step }) => {
    const { userId, todoId, todoText } = event.data as {
      userId: string
      todoId: string
      todoText: string
    }

    const researchId = `research-${todoId}`

    // Mark as running
    await step.run("mark-running", async () => {
      await supabaseAdmin.from("todo_research").upsert({
        id: researchId,
        user_id: userId,
        todo_id: todoId,
        todo_text: todoText,
        status: "running",
      })
    })

    const context = await step.run("load-company-context", () =>
      getCompanyContext(userId, { queryHint: todoText, refreshVault: "if_stale" }),
    )

    const companyContext = context
      ? [
          context.profile.name ? `Company: ${context.profile.name}` : "",
          context.profile.problem ? `Problem: ${context.profile.problem}` : "",
          context.extracted?.keywords?.length ? `Keywords: ${context.extracted.keywords.slice(0, 8).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : ""

    const output = await step.run("run-research", () => researchTodo(todoText, companyContext))

    await step.run("persist-results", async () => {
      const { error } = await supabaseAdmin.from("todo_research").upsert({
        id: researchId,
        user_id: userId,
        todo_id: todoId,
        todo_text: todoText,
        status: "done",
        summary: output.summary,
        key_findings: output.keyFindings,
        action_items: output.actionItems,
        sources: output.sources,
        completed_at: new Date().toISOString(),
      })
      if (error) console.error("[todo-research] persist:", error.message)
    })

    return { userId, todoId, findings: output.keyFindings.length, actions: output.actionItems.length }
  },
)
