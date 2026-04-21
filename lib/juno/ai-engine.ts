/**
 * Juno AI engine — LinkedIn, lead fit, outreach, trends, comments.
 * Uses full CompanyContext.promptBlock with the configured LLM (OpenRouter via qwenModel() / llmModel()).
 */

import type { CompanyContext } from "@/lib/company-context"
import { runLookalikeConversionAnalysis } from "@/lib/lookalike/ai-profile"
import { dimensionsToLegacyCriteria } from "@/lib/lookalike/derive-legacy"
import type { LookalikeDimensions, OutreachPlaybook, PlatformQuery } from "@/types/lookalike"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"
import type { ScoredItem } from "./types"

// ─── LinkedIn Post Generation ────────────────────────────────────

export async function generateLinkedInPost(params: {
  context: CompanyContext
  briefItems: ScoredItem[]
  /** Last N dismissal reasons — CMO learns what to avoid */
  dismissalFeedbackBlock?: string
}): Promise<{ post: string; angle: string }> {
  if (!isLlmConfigured()) {
    return { post: "", angle: "Set LLM_API_KEY or OPENROUTER_API_KEY" }
  }

  const feedback = params.dismissalFeedbackBlock?.trim()
    ? `\n\n${params.dismissalFeedbackBlock.trim()}\n`
    : ""

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 1500,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You are writing a LinkedIn post AS this founder. You know their company deeply from the context below. Write in their voice — as someone who is building this specific thing, in this specific market.

${params.context.promptBlock}
${feedback}
TODAY'S INTELLIGENCE (from daily brief):
${params.briefItems
  .slice(0, 5)
  .map(
    (i) =>
      `- ${i.title}: ${i.whyItMatters} (Strategic: ${i.strategicImplication})`,
  )
  .join("\n")}

Write ONE LinkedIn post. Rules:
- First person, as the founder
- Open with a hook (controversial take, surprising insight, lesson from building)
- Reference something specific about your company, market, or journey
- Short paragraphs (1-2 sentences)
- 150-250 words
- Tie to today's brief if there's a natural angle
- End with a question or discussion prompt
- NO hashtags unless genuinely relevant (max 2)
- Sound like someone who builds, not someone who talks about building
- If you reference your product, be specific about what it does based on the context

Return JSON: {"angle": "one sentence describing the content angle", "post": "the full post text"}`),
      },
    ],
  })
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as { post?: string; angle?: string }
    return { post: parsed.post || "", angle: parsed.angle || "" }
  } catch {
    return { post: text, angle: "Generated post" }
  }
}

// ─── Lead Scoring ────────────────────────────────────────────────

export async function scoreLeadFit(params: {
  context: CompanyContext
  company: string
  role: string
  description: string
}): Promise<{
  icpFit: number
  timing: "urgent" | "warm" | "cold"
  budgetSignal: "high" | "medium" | "low"
  pitchAngle: string
}> {
  const fallback = {
    icpFit: 5,
    timing: "warm" as const,
    budgetSignal: "medium" as const,
    pitchAngle: "Review manually",
  }

  if (!isLlmConfigured()) return fallback

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 500,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You are qualifying a lead for a startup. You know everything about the company from the context below — their product, their ICP, how they create value. Use this to judge fit precisely.

${params.context.promptBlock}

LEAD:
- Company: ${params.company}
- They're hiring for: ${params.role}
- Job description: ${params.description.substring(0, 800)}

Questions to answer:
- Does this company match our ICP?
- Does the role they're hiring for indicate a need our product addresses?
- What specific value could we offer them?

Return JSON:
{
  "icpFit": 0-10,
  "timing": "urgent" | "warm" | "cold",
  "budgetSignal": "high" | "medium" | "low",
  "pitchAngle": "one specific sentence referencing THEIR role and OUR product capability"
}`),
      },
    ],
  })
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as Partial<{
      icpFit: number
      timing: string
      budgetSignal: string
      pitchAngle: string
    }>
    const timing = ["urgent", "warm", "cold"].includes(parsed.timing ?? "")
      ? (parsed.timing as "urgent" | "warm" | "cold")
      : fallback.timing
    const budgetSignal = ["high", "medium", "low"].includes(parsed.budgetSignal ?? "")
      ? (parsed.budgetSignal as "high" | "medium" | "low")
      : fallback.budgetSignal
    return {
      icpFit: typeof parsed.icpFit === "number" ? Math.min(10, Math.max(0, parsed.icpFit)) : fallback.icpFit,
      timing,
      budgetSignal,
      pitchAngle: typeof parsed.pitchAngle === "string" ? parsed.pitchAngle : fallback.pitchAngle,
    }
  } catch {
    return fallback
  }
}

// ─── Outreach Generation ─────────────────────────────────────────

export async function generateOutreach(params: {
  context: CompanyContext
  company: string
  role: string
  jobUrl: string
  pitchAngle: string
}): Promise<{
  linkedinConnect: string
  linkedinDM: string
  email: string
}> {
  const empty = { linkedinConnect: "", linkedinDM: "", email: "" }
  if (!isLlmConfigured()) return empty

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 2000,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You are drafting outreach AS this founder. You know their company deeply — write from their authentic perspective, referencing real details about what they've built.

${params.context.promptBlock}

TARGET:
- Company: ${params.company}
- They're hiring: ${params.role}
- Job posting: ${params.jobUrl}
- Why we're a fit: ${params.pitchAngle}

Generate three messages written as the founder:
1. LinkedIn connection request (300 chars MAX)
2. LinkedIn DM follow-up (if they accept)
3. Cold email (with subject line)

Rules:
- Reference the specific job posting
- Reference specific capabilities of OUR product from the context
- Lead with value: what problem we solve for THEM
- Sound like a founder, not a sales team
- "Would it be worth a quick chat?" not "Book a demo"

Return JSON: {"linkedinConnect": "...", "linkedinDM": "...", "email": "..."}`),
      },
    ],
  })
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as Partial<typeof empty>
    return {
      linkedinConnect: parsed.linkedinConnect ?? "",
      linkedinDM: parsed.linkedinDM ?? "",
      email: parsed.email ?? "",
    }
  } catch {
    return empty
  }
}

// ─── Tech Trend Analysis ─────────────────────────────────────────

export async function analyzeTechTrends(params: {
  context: CompanyContext
  items: Array<{ title: string; source: string; description: string }>
}): Promise<{
  trends: Array<{ trend: string; relevance: string; action: string }>
  postSuggestions: string[]
}> {
  const empty = { trends: [] as Array<{ trend: string; relevance: string; action: string }>, postSuggestions: [] as string[] }
  if (!isLlmConfigured()) return empty

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 2000,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You are a CTO analyst. You know this company's product, tech stack, and market from the context below. Analyse how recent tech developments affect THEM specifically.

${params.context.promptBlock}

Recent tech news and releases:
${params.items
  .slice(0, 15)
  .map((i) => `- [${i.source}] ${i.title}: ${i.description.substring(0, 200)}`)
  .join("\n")}

Analyse:
1. Key trends that affect THIS company's product or stack (max 5)
   - Each trend should reference specific aspects of our product/stack
2. Technical post/thread ideas for HN, Reddit, or dev.to (max 3)
   - Each should position the founder as an expert in their specific domain

Return JSON:
{
  "trends": [{"trend": "...", "relevance": "how this specifically affects us", "action": "concrete next step"}],
  "postSuggestions": ["topic and angle tied to our expertise"]
}`),
      },
    ],
  })
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as Partial<typeof empty>
    return {
      trends: Array.isArray(parsed.trends) ? parsed.trends : [],
      postSuggestions: Array.isArray(parsed.postSuggestions) ? parsed.postSuggestions : [],
    }
  } catch {
    return empty
  }
}

// ─── Comment Generation ──────────────────────────────────────────

export async function generateComments(params: {
  context: CompanyContext
  targetPosts: Array<{ author: string; content: string; url: string }>
  dismissalFeedbackBlock?: string
}): Promise<Array<{ author: string; url: string; comment: string }>> {
  if (params.targetPosts.length === 0) return []
  if (!isLlmConfigured()) return []

  const feedback = params.dismissalFeedbackBlock?.trim()
    ? `\n\n${params.dismissalFeedbackBlock.trim()}\n`
    : ""

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 2000,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You write LinkedIn comments AS this founder. You know their company, expertise, and perspective from the context below. Comments should reflect their specific domain knowledge.

${params.context.promptBlock}
${feedback}
For each post, write a comment that:
- Adds value from the founder's specific expertise/experience
- References something concrete (a pattern they've seen building their product, data from their market)
- 2-3 sentences max
- NEVER sycophantic
- Sounds like a peer with deep domain knowledge

POSTS:
${params.targetPosts.map((p, i) => `[${i}] By ${p.author}:\n"${p.content.substring(0, 300)}..."`).join("\n\n")}

Return JSON array: [{"index": 0, "comment": "..."}]`),
      },
    ],
  })
  try {
    const parsed = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]") as Array<{ index?: number; comment?: string }>
    return parsed.map((c) => ({
      author: params.targetPosts[c.index ?? 0]?.author || "Unknown",
      url: params.targetPosts[c.index ?? 0]?.url || "",
      comment: c.comment ?? "",
    }))
  } catch {
    return []
  }
}

// ─── Lookalike / distribution conversion engine ─────────────────

export type AnalyseConversionOutput = {
  convertedLead: {
    name: string
    roleTitle: string
    company: string
    location?: string
    channel: string
    responseTime: string
    multiplierNote: string
  }
  /** Legacy flat criteria (derived from 7-dimension profile) for UI pills and Apollo URL builders. */
  lookalike: {
    targetTitles: string[]
    companyTypes: string[]
    geography: string[]
    companySize: string[]
  }
  rationale: string
  searchQueries: {
    linkedinSalesNav: string
    apollo: string
    linkedinBoolean: string
    apolloAppUrl?: string
  }
  templates: {
    inmail: string
    coldEmail: string
  }
  pitchAngle: string
  segmentTag: string
  insightsHeadline: string
  similarExistingLeadsCount: number
  proactiveMessage: string
  /** Resolved from numbered list — company + role / hiring context (person name when we have it later). */
  similarExistingLeads: Array<{ company: string; role: string; contactName?: string }>
  /** Layer 1 — full weighted dimensions (also persisted to lookalike_profiles). */
  dimensions?: LookalikeDimensions
  outreachPlaybook?: OutreachPlaybook
  profileName?: string
  platformQueries?: PlatformQuery[]
}

export async function analyseConversionForLookalike(params: {
  context: CompanyContext
  conversion: {
    name: string
    title: string
    company: string
    location?: string
    whyItWorked?: string
    channel?: string
    responseTime?: string
    companyType?: string
    industry?: string
    companySize?: string
  }
  existingLeadSnippets?: Array<{ company: string; role: string; contactName?: string }>
}): Promise<AnalyseConversionOutput> {
  const analysis = await runLookalikeConversionAnalysis({
    context: params.context,
    conversion: params.conversion,
    existingLeadSnippets: params.existingLeadSnippets,
  })
  const legacy = dimensionsToLegacyCriteria(analysis.dimensions)
  return {
    convertedLead: analysis.convertedLead,
    lookalike: legacy,
    rationale: analysis.rationale,
    searchQueries: {
      linkedinSalesNav: analysis.searchQueries.linkedinSalesNav,
      apollo: analysis.searchQueries.apollo,
      linkedinBoolean: analysis.searchQueries.linkedinBoolean,
      apolloAppUrl: analysis.searchQueries.apolloAppUrl,
    },
    templates: analysis.templates,
    pitchAngle: analysis.pitchAngle,
    segmentTag: analysis.segmentTag,
    insightsHeadline: analysis.insightsHeadline,
    similarExistingLeadsCount: analysis.similarExistingLeadsCount,
    proactiveMessage: analysis.proactiveMessage,
    similarExistingLeads: analysis.similarExistingLeads,
    dimensions: analysis.dimensions,
    outreachPlaybook: analysis.outreachPlaybook,
    profileName: analysis.profileName,
    platformQueries: analysis.platformQueries,
  }
}

export async function personalizeDistributionLead(params: {
  context: CompanyContext
  conversion: {
    rationale: string
    multiplierNote: string
    pitchAngle: string
    templateInmail: string
    templateColdEmail: string
  }
  /** Optional — full 7-dimension JSON for tighter personalization */
  dimensionsJson?: string
  lead: {
    firstName: string
    lastName: string
    title: string
    company: string
    location: string
  }
}): Promise<{
  fitScore: number
  personalizedInmail: string
  personalizedEmail: string
}> {
  const empty = { fitScore: 70, personalizedInmail: "", personalizedEmail: "" }
  if (!isLlmConfigured()) return empty

  const fullName = [params.lead.firstName, params.lead.lastName].filter(Boolean).join(" ").trim()
  const dimBlock = params.dimensionsJson?.trim()
    ? `\nWEIGHTED ICP DIMENSIONS (use as guardrails; do not recite verbatim):\n${params.dimensionsJson.trim()}\n`
    : ""

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 2500,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You personalize outbound for a founder. Use the winning conversion playbook and templates; replace merge fields with REAL values and add ONE short sentence that references this person's company or role specifically (not generic praise).

${params.context.promptBlock}
${dimBlock}
PLAYBOOK (why the original conversion worked):
${params.conversion.rationale}

Multiplier / leverage: ${params.conversion.multiplierNote}
Core angle: ${params.conversion.pitchAngle}

BASE TEMPLATES (use structure; improve wording as needed):
--- InMail base ---
${params.conversion.templateInmail}

--- Cold email base ---
${params.conversion.templateColdEmail}

LEAD ROW:
- Name: ${fullName}
- Function/title: ${params.lead.title}
- Company: ${params.lead.company}
- Location: ${params.lead.location || "—"}

Return JSON ONLY:
{
  "fitScore": 0-100,
  "personalizedInmail": "full InMail body, no placeholders left",
  "personalizedEmail": "full email including Subject: line first"
}

Rules:
- No remaining {placeholders} — substitute real name, company, title.
- Sound like the founder, not marketing automation.
- personalizedInmail: LinkedIn-appropriate length.
- fitScore: how well this lead matches the winning conversion profile.`),
      },
    ],
  })
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as Partial<{
      fitScore: number
      personalizedInmail: string
      personalizedEmail: string
    }>
    return {
      fitScore:
        typeof parsed.fitScore === "number" ? Math.min(100, Math.max(0, parsed.fitScore)) : 72,
      personalizedInmail: String(parsed.personalizedInmail ?? ""),
      personalizedEmail: String(parsed.personalizedEmail ?? ""),
    }
  } catch {
    return empty
  }
}
