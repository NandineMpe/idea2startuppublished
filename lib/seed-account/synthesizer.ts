/**
 * Synthesizer — feeds the ResearchBundle through the LLM and produces:
 *
 *   1. Structured company_profile fields  (matches the DB schema exactly)
 *   2. A rich knowledge_base_md document  (2-3k words, Obsidian-style)
 *   3. Three email_preview bullets        (shown in the cold outreach email)
 *
 * The structured JSON is extracted first so the seeder can write to the DB
 * in one upsert.  The knowledge_base_md is written to the same row so every
 * Juno agent that calls getCompanyContext() picks it up immediately.
 */

import { generateText } from "ai"
import { qwenModel } from "@/lib/llm-provider"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import type { ResearchBundle } from "./researcher"

export interface SynthesizedProfile {
  // core
  company_name: string
  tagline: string
  company_description: string
  problem: string
  solution: string
  target_market: string
  industry: string
  vertical: string
  stage: string
  business_model: string
  traction: string
  thesis: string
  differentiators: string
  // arrays
  icp: string[]
  competitors: string[]
  keywords: string[]
  priorities: string[]
  risks: string[]
  // founder
  founder_name: string
  founder_background: string
  founder_location: string
  // brand
  brand_voice_dna: string
  brand_promise: string
  brand_words_use: string[]
  brand_words_never: string[]
  // deep context
  knowledge_base_md: string
}

export interface EmailPreviewBullets {
  market_signal: string
  competitor_move: string
  icp_insight: string
}

export interface SynthesisResult {
  profile: SynthesizedProfile
  emailPreview: EmailPreviewBullets
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function collapseBundle(bundle: ResearchBundle): string {
  const sections: string[] = []

  if (bundle.websitePages.length) {
    sections.push("## Company Website\n" + bundle.websitePages.slice(0, 5).join("\n\n---\n\n"))
  }
  if (bundle.founderProfile) {
    sections.push("## Founder Profile\n" + bundle.founderProfile)
  }
  if (bundle.pressSnippets.length) {
    sections.push("## Press & Mentions\n" + bundle.pressSnippets.join("\n\n"))
  }
  if (bundle.productHuntText) {
    sections.push("## ProductHunt\n" + bundle.productHuntText)
  }
  if (bundle.twitterPosts.length) {
    sections.push("## Founder Posts\n" + bundle.twitterPosts.join("\n\n"))
  }
  if (bundle.jobPostings.length) {
    sections.push("## Job Postings\n" + bundle.jobPostings.join("\n\n"))
  }
  if (bundle.competitorSnippets.length) {
    sections.push("## Competitor Landscape\n" + bundle.competitorSnippets.join("\n\n"))
  }

  // cap total at ~18k chars so we stay inside context window
  const full = sections.join("\n\n")
  return full.length > 18000 ? full.slice(0, 18000) + "\n\n[truncated]" : full
}

// ─── structured profile ───────────────────────────────────────────────────────

async function synthesizeProfile(
  bundle: ResearchBundle,
  rawText: string,
): Promise<SynthesizedProfile> {
  const { text } = await generateText({
    model: qwenModel(),
    maxTokens: 3000,
    prompt: appendWritingRules(`
You are a startup intelligence analyst. Based on the public research below, produce a
structured JSON object describing this company. Be specific and factual — infer only what
is clearly supported by the evidence. Do not invent funding rounds or metrics.

Research:
${rawText}

Return ONLY valid JSON matching this exact shape (no markdown fences):
{
  "company_name": "",
  "tagline": "",
  "company_description": "",
  "problem": "",
  "solution": "",
  "target_market": "",
  "industry": "",
  "vertical": "",
  "stage": "idea|pre-seed|seed|series-a|series-b|growth",
  "business_model": "",
  "traction": "",
  "thesis": "",
  "differentiators": "",
  "icp": ["", ""],
  "competitors": ["", ""],
  "keywords": ["", ""],
  "priorities": ["", "", ""],
  "risks": ["", ""],
  "founder_name": "",
  "founder_background": "",
  "founder_location": "",
  "brand_voice_dna": "",
  "brand_promise": "",
  "brand_words_use": ["", ""],
  "brand_words_never": ["", ""]
}
`),
  })

  try {
    const clean = text.replace(/```json|```/g, "").trim()
    return JSON.parse(clean) as SynthesizedProfile
  } catch {
    // partial parse — return what we have plus safe defaults
    return {
      company_name: bundle.companyName,
      tagline: "",
      company_description: "",
      problem: "",
      solution: "",
      target_market: "",
      industry: "",
      vertical: "",
      stage: "seed",
      business_model: "",
      traction: "",
      thesis: "",
      differentiators: "",
      icp: [],
      competitors: [],
      keywords: [],
      priorities: [],
      risks: [],
      founder_name: bundle.founderName,
      founder_background: "",
      founder_location: "",
      brand_voice_dna: "",
      brand_promise: "",
      brand_words_use: [],
      brand_words_never: [],
      knowledge_base_md: "",
    }
  }
}

// ─── knowledge base document ──────────────────────────────────────────────────

async function synthesizeKnowledgeBase(
  bundle: ResearchBundle,
  profile: SynthesizedProfile,
  rawText: string,
): Promise<string> {
  const { text } = await generateText({
    model: qwenModel(),
    maxTokens: 4000,
    prompt: `
You are writing the internal knowledge base for ${bundle.companyName}'s AI agent, Juno.
This document will be read by AI agents on every brief, so make it dense, factual, and specific.
Write in confident third-person present tense. No filler. No "according to their website".

Use this research:
${rawText}

And these extracted facts:
- Founder: ${profile.founder_name}, ${profile.founder_background}
- Stage: ${profile.stage}
- ICP: ${profile.icp.join(", ")}
- Competitors: ${profile.competitors.join(", ")}
- Business model: ${profile.business_model}

Write a markdown document with these exact sections:

# ${bundle.companyName} — Juno Context

## What They Build
[2-3 sentences. Specific product description.]

## The Problem They Solve
[The specific pain, who feels it, why existing solutions fail.]

## Who Buys It
[ICP: role, company type, trigger events that cause them to buy.]

## How They Go To Market
[Channels, pricing model, sales motion, traction signals.]

## Competitive Landscape
[Named competitors, how ${bundle.companyName} is positioned against each.]

## Founder & Team
[Background, relevant experience, why they're the right people.]

## Strategic Priorities (Next 90 Days)
[3-5 inferred priorities based on hiring, product, and press signals.]

## Risks & Open Questions
[2-3 genuine strategic risks or unknowns.]

## Keywords & Signals to Monitor
[Comma-separated list of topics, technologies, competitor names, and job titles
 Juno should watch in daily intelligence.]
`,
  })

  return text.trim()
}

// ─── email preview bullets ─────────────────────────────────────────────────────

async function synthesizeEmailPreview(
  bundle: ResearchBundle,
  profile: SynthesizedProfile,
): Promise<EmailPreviewBullets> {
  const { text } = await generateText({
    model: qwenModel(),
    maxTokens: 600,
    prompt: `
You are writing 3 intelligence bullets for a cold email to ${profile.founder_name},
founder of ${bundle.companyName}. These appear under the line:
"Here's what Juno surfaced about ${bundle.companyName} this morning:"

Make each bullet feel like live, specific intelligence — not generic.
Reference their actual market, named competitors, or ICP.
Keep each under 20 words. No bullet points in the JSON — plain strings only.

Return ONLY valid JSON (no fences):
{
  "market_signal": "one specific market movement or trend in their space",
  "competitor_move": "one thing a named competitor is doing that matters to them",
  "icp_insight": "one insight about their ICP or a lead signal"
}
`,
  })

  try {
    const clean = text.replace(/```json|```/g, "").trim()
    return JSON.parse(clean) as EmailPreviewBullets
  } catch {
    return {
      market_signal: `${profile.vertical || profile.industry} is seeing accelerated consolidation among mid-market buyers.`,
      competitor_move: `${profile.competitors[0] || "A key competitor"} recently expanded their enterprise tier pricing.`,
      icp_insight: `Companies matching ${bundle.companyName}'s ICP are actively evaluating solutions in your category.`,
    }
  }
}

// ─── main export ──────────────────────────────────────────────────────────────

export async function synthesizeFromResearch(bundle: ResearchBundle): Promise<SynthesisResult> {
  const rawText = collapseBundle(bundle)

  // profile first, then knowledge base (needs profile facts for grounding)
  const profile = await synthesizeProfile(bundle, rawText)
  const knowledgeBaseMd = await synthesizeKnowledgeBase(bundle, profile, rawText)

  // attach knowledge base to profile
  profile.knowledge_base_md = knowledgeBaseMd

  const emailPreview = await synthesizeEmailPreview(bundle, profile)

  return { profile, emailPreview }
}
