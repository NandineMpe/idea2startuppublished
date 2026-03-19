/**
 * Shared AI tool registry.
 * Each tool has a prompt and a list of required/optional input fields.
 * Used by /api/ai-tool (direct tool calls) and /api/delegate/plan (agent delegation).
 */

import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"

// ─── Tool field descriptors ──────────────────────────────────────────────────

export interface ToolField {
  key: string
  label: string
  placeholder?: string
  type: "input" | "textarea" | "select"
  options?: { value: string; label: string }[]
  required?: boolean
}

export interface ToolDefinition {
  id: string
  label: string
  agent: "cbs" | "cro" | "cmo" | "cfo" | "coo"
  systemPrompt: string
  fields: ToolField[]
}

// ─── Tool definitions ────────────────────────────────────────────────────────

export const TOOLS: Record<string, ToolDefinition> = {
  "opportunity-scanner": {
    id: "opportunity-scanner",
    label: "Business Opportunity Scanner",
    agent: "cbs",
    systemPrompt: `You are a market opportunity analyst. Given a business domain or industry, identify 5-8 emerging opportunities. For each opportunity provide:
- Opportunity name
- Market size estimate
- Growth trajectory (emerging/growing/mature)
- Why now (timing factors)
- Key risks
- Actionable next step

Format with ## headers for each opportunity. Be specific with data points and market evidence.`,
    fields: [
      { key: "Industry", label: "Industry or Domain", placeholder: "e.g., Healthcare, Fintech, EdTech", type: "input", required: true },
      { key: "Focus Area", label: "Specific Focus Area", placeholder: "e.g., AI diagnostics, payment infrastructure", type: "input" },
      { key: "Target Market", label: "Target Market", placeholder: "e.g., North America, Europe, Global", type: "input" },
      { key: "Stage", label: "Your Current Stage", placeholder: "Select stage", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "mvp", label: "MVP" }, { value: "launched", label: "Launched" }, { value: "growth", label: "Growth" }] },
    ],
  },

  "competition-advanced": {
    id: "competition-advanced",
    label: "Advanced Competition Analyzer",
    agent: "cro",
    systemPrompt: `You are a competitive strategy consultant. Perform a deep competitive analysis including:
## SWOT Analysis
Strengths, Weaknesses, Opportunities, Threats in detail.

## Competitive Positioning Map
Describe where key players sit on price vs. feature axes.

## Competitive Moats
What defenses do incumbents have? What gaps exist?

## Head-to-Head Comparison
For top 5 competitors: name, model, funding, strengths, weaknesses, pricing.

## Strategic Recommendations
3-5 specific strategies to differentiate and win.

Be analytical and specific. Use real companies and data where possible.`,
    fields: [
      { key: "Startup", label: "Your Startup", placeholder: "Describe what you're building", type: "textarea", required: true },
      { key: "Industry", label: "Industry", placeholder: "e.g., B2B SaaS, Consumer App", type: "input", required: true },
      { key: "Key Competitors", label: "Known Competitors", placeholder: "List any competitors you know", type: "input" },
    ],
  },

  "global-events": {
    id: "global-events",
    label: "Global Startup Events",
    agent: "cmo",
    systemPrompt: `You are a startup ecosystem expert. Based on the startup's industry and stage, recommend 10-15 relevant events, accelerators, and networking opportunities. For each:
- Event/program name
- Location and dates (or "ongoing")
- Type (conference/accelerator/pitch competition/meetup/hackathon)
- Why it's relevant
- Application deadline or registration link pattern
- Cost (free/paid/application-based)

Group by: Conferences, Accelerators & Programs, Pitch Competitions, Online Communities.
Be specific with real events and programs.`,
    fields: [
      { key: "Industry", label: "Industry", placeholder: "e.g., HealthTech, AI, Climate", type: "input", required: true },
      { key: "Stage", label: "Stage", placeholder: "Select stage", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "mvp", label: "MVP" }, { value: "launched", label: "Launched" }, { value: "growth", label: "Growth" }] },
      { key: "Location", label: "Your Location", placeholder: "e.g., London, New York, Remote", type: "input" },
    ],
  },

  "internationalisation": {
    id: "internationalisation",
    label: "Internationalisation Strategy",
    agent: "cmo",
    systemPrompt: `You are an international expansion strategist. Create a market entry strategy including:
## Market Attractiveness Assessment
Score target markets on: market size, growth rate, competitive intensity, regulatory ease, cultural fit, talent availability.

## Entry Strategy Options
For the top 3 markets: recommended entry mode (direct/partnership/acquisition), timeline, resource requirements, key risks.

## Regulatory & Compliance
Key legal requirements, data protection, employment law, tax implications for each market.

## Localization Requirements
Product, marketing, pricing, and support adaptations needed.

## Financial Projections
Estimated costs, timeline to profitability, key assumptions.

Be specific to the startup's industry and product.`,
    fields: [
      { key: "Startup", label: "Your Startup", placeholder: "Describe your product/service", type: "textarea", required: true },
      { key: "Current Market", label: "Current Market", placeholder: "e.g., US, UK", type: "input", required: true },
      { key: "Target Markets", label: "Target Markets", placeholder: "e.g., Europe, Southeast Asia", type: "input" },
      { key: "Industry", label: "Industry", placeholder: "e.g., SaaS, Marketplace", type: "input" },
    ],
  },

  "financial-engineering": {
    id: "financial-engineering",
    label: "Financial Engineering",
    agent: "cfo",
    systemPrompt: `You are a startup financial strategist. Create comprehensive financial projections including:
## Revenue Model
Revenue streams, pricing strategy, conversion assumptions.

## 3-Year Financial Projections
Monthly for Year 1, quarterly for Years 2-3. Include: Revenue, COGS, Gross Margin, OpEx breakdown, EBITDA, Cash Flow.

## Unit Economics
CAC, LTV, LTV/CAC ratio, payback period, gross margin per unit.

## Burn Rate & Runway
Monthly burn, current runway, when to fundraise.

## Scenario Analysis
Best case, base case, worst case with key variables.

## Key Assumptions
List every assumption explicitly. Flag which are validated vs. hypothetical.

Use realistic numbers based on the industry and stage.`,
    fields: [
      { key: "Business Model", label: "Business Model", placeholder: "e.g., SaaS subscription, marketplace 10% take rate", type: "input", required: true },
      { key: "Industry", label: "Industry", placeholder: "e.g., B2B SaaS, Marketplace", type: "input", required: true },
      { key: "Stage", label: "Current Stage", placeholder: "Select stage", type: "select", options: [{ value: "pre-revenue", label: "Pre-Revenue" }, { value: "early", label: "Early Revenue" }, { value: "growth", label: "Growth" }] },
      { key: "Target Revenue", label: "Year 1 Target Revenue", placeholder: "e.g., $500K", type: "input" },
    ],
  },

  "funding-readiness": {
    id: "funding-readiness",
    label: "Funding Readiness Score",
    agent: "cfo",
    systemPrompt: `You are a fundraising readiness assessor. Score the startup across these dimensions (1-10 each):
## Team Score
Founder-market fit, relevant experience, completeness of team, advisory board.

## Product Score
Stage of development, user feedback, technical moat, scalability.

## Market Score
Market size, growth rate, timing, competitive positioning.

## Traction Score
Revenue, users, growth rate, engagement, partnerships.

## Financial Score
Unit economics, burn rate, runway, capital efficiency.

## Overall Readiness Score
Weighted average with explanation.

## Critical Gaps
What must be fixed before fundraising.

## Recommended Next Steps
Prioritized list of 5-7 actions to improve readiness.

Provide specific, actionable feedback with examples.`,
    fields: [
      { key: "Startup", label: "Startup Description", placeholder: "Describe your startup, product, team, and traction", type: "textarea", required: true },
      { key: "Stage", label: "Fundraise Target", placeholder: "e.g., Pre-Seed $500K, Seed $2M", type: "input" },
      { key: "Current Traction", label: "Current Traction", placeholder: "e.g., 100 users, $10K MRR", type: "input" },
    ],
  },

  "funding-strategy": {
    id: "funding-strategy",
    label: "Funding Strategy Optimizer",
    agent: "cfo",
    systemPrompt: `You are a fundraising strategy advisor. Create a comprehensive funding strategy including:
## Funding Options Analysis
Compare: bootstrapping, angel investment, pre-seed/seed VC, grants, revenue-based financing, crowdfunding. Rate fit for this startup.

## Recommended Approach
Primary and backup funding strategies with rationale.

## Target Raise
How much to raise, valuation range, dilution analysis.

## Investor Targeting
Types of investors to target, 5-10 specific funds/angels that match, why each is relevant.

## Pitch Strategy
Key narrative, metrics to highlight, objections to prepare for.

## Timeline & Milestones
Fundraising timeline, key milestones before/during/after raise.

## Term Sheet Considerations
Key terms to negotiate, common pitfalls, walk-away points.`,
    fields: [
      { key: "Startup", label: "Startup Description", placeholder: "Describe your startup", type: "textarea", required: true },
      { key: "Stage", label: "Current Stage", placeholder: "Select stage", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "mvp", label: "MVP" }, { value: "launched", label: "Launched" }, { value: "growth", label: "Growth" }] },
      { key: "Amount", label: "Target Raise Amount", placeholder: "e.g., $1M, $5M", type: "input" },
      { key: "Use of Funds", label: "Use of Funds", placeholder: "e.g., product, team, marketing", type: "input" },
    ],
  },

  "cap-table": {
    id: "cap-table",
    label: "Cap Table Management",
    agent: "cfo",
    systemPrompt: `You are a cap table and equity advisor. Based on the startup details, create:
## Current Cap Table
Founders, employees, advisors, investors with shares, percentages, vesting schedules.

## Option Pool
Recommended ESOP size, allocation strategy, vesting terms.

## Scenario Modeling
Model 3 fundraising rounds: Pre-Seed, Seed, Series A. Show dilution at each stage.

## Valuation Analysis
Pre-money and post-money at each stage, comparable companies, valuation methods.

## Key Recommendations
Equity split advice, vesting recommendations, anti-dilution considerations.

Present tables clearly with percentages and share counts.`,
    fields: [
      { key: "Founders", label: "Founders & Roles", placeholder: "e.g., 2 co-founders, technical + business", type: "input", required: true },
      { key: "Stage", label: "Current Stage", placeholder: "Select stage", type: "select", options: [{ value: "pre-seed", label: "Pre-Seed" }, { value: "seed", label: "Seed" }, { value: "series-a", label: "Series A" }] },
      { key: "Investors", label: "Existing Investors", placeholder: "e.g., none, 2 angels with $200K", type: "input" },
    ],
  },

  "startup-credits": {
    id: "startup-credits",
    label: "Startup Credits Database",
    agent: "cfo",
    systemPrompt: `You are a startup benefits researcher. List all available startup credit programs and perks. For each:
- Program name
- Provider (AWS, Google, Microsoft, Stripe, etc.)
- Value (dollar amount or description)
- Eligibility requirements
- How to apply
- Application tips

Group by category: Cloud Credits, Development Tools, Marketing & Growth, Financial & Legal, Other.
Include at least 20 programs. Focus on programs currently available. Mention any with deadlines.`,
    fields: [
      { key: "Stage", label: "Startup Stage", placeholder: "Select stage", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "mvp", label: "MVP" }, { value: "launched", label: "Launched" }] },
      { key: "Industry", label: "Industry", placeholder: "e.g., SaaS, HealthTech, AI", type: "input" },
    ],
  },

  "llc-formation": {
    id: "llc-formation",
    label: "LLC Formation Service",
    agent: "coo",
    systemPrompt: `You are a business formation advisor. Create a comprehensive guide for forming a business entity:
## Entity Type Comparison
LLC vs C-Corp vs S-Corp vs Sole Proprietorship. Compare: liability protection, taxation, fundraising compatibility, complexity, cost.

## Recommended Entity
Best choice for this startup with reasoning.

## Formation Steps
Step-by-step checklist with estimated costs and timelines for the recommended entity.

## State Selection
Compare top 3 states (Delaware, Wyoming, home state). Costs, taxes, privacy, legal precedent.

## Required Documents
Articles of incorporation/organization, operating agreement, EIN application, state registrations.

## Post-Formation Checklist
Bank accounts, licenses, insurance, accounting setup, compliance calendar.

## Estimated Costs
Itemized formation costs and ongoing annual costs.`,
    fields: [
      { key: "Location", label: "Where You Operate", placeholder: "e.g., California, Texas, Remote", type: "input", required: true },
      { key: "Industry", label: "Industry", placeholder: "e.g., SaaS, Marketplace, HealthTech", type: "input" },
      { key: "Fundraising Plans", label: "Fundraising Plans", placeholder: "e.g., planning to raise VC, bootstrapping", type: "input" },
    ],
  },

  "legal-requirements": {
    id: "legal-requirements",
    label: "Startup Legal Requirements",
    agent: "coo",
    systemPrompt: `You are a startup legal advisor. Create a comprehensive legal requirements checklist:
## Business Structure & Registration
Entity formation, state registrations, EIN, business licenses.

## Intellectual Property
Trademarks, patents, copyrights, trade secrets, IP assignment agreements.

## Contracts & Agreements
Co-founder agreement, employment contracts, NDAs, terms of service, privacy policy, contractor agreements.

## Employment & HR
Employment law basics, at-will employment, independent contractor rules, equity compensation, benefits requirements.

## Data & Privacy
GDPR, CCPA, data processing agreements, privacy policy requirements, cookie consent.

## Industry-Specific
Regulations specific to the startup's industry.

## Compliance Calendar
Monthly/quarterly/annual compliance deadlines.

For each item: what it is, why it matters, estimated cost, DIY vs. lawyer recommendation.`,
    fields: [
      { key: "Industry", label: "Industry", placeholder: "e.g., FinTech, HealthTech, SaaS", type: "input", required: true },
      { key: "Location", label: "Jurisdiction", placeholder: "e.g., US (California), UK, EU", type: "input" },
      { key: "Stage", label: "Stage", placeholder: "Select stage", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "mvp", label: "MVP" }, { value: "launched", label: "Launched" }] },
    ],
  },

  "recruiting": {
    id: "recruiting",
    label: "Recruiting Agent",
    agent: "coo",
    systemPrompt: `You are a startup recruiting strategist. Create a hiring plan including:
## Team Assessment
Current gaps, critical hires for next 6-12 months, nice-to-have hires.

## Role Definitions
For each recommended hire: title, key responsibilities, must-have skills, nice-to-have skills, salary range, equity allocation.

## Job Description
Write a compelling job description for the most critical hire.

## Sourcing Strategy
Where to find candidates: platforms, communities, referral programs, recruiters.

## Interview Process
Recommended interview stages, questions for each stage, evaluation criteria, red/green flags.

## Compensation Strategy
Base salary ranges, equity framework, benefits package, comparison to market rates.

## Onboarding Plan
First 30-60-90 days plan for new hires.`,
    fields: [
      { key: "Current Team", label: "Current Team", placeholder: "e.g., 2 founders (1 technical, 1 business)", type: "input", required: true },
      { key: "Stage", label: "Stage & Budget", placeholder: "e.g., Seed, $2M raised, 18mo runway", type: "input" },
      { key: "Priority Hire", label: "Most Urgent Hire", placeholder: "e.g., Lead Engineer, Head of Sales", type: "input" },
    ],
  },

  "business-plan": {
    id: "business-plan",
    label: "Full Business Plan",
    agent: "coo",
    systemPrompt: `You are a business plan consultant. Create a comprehensive business plan:
## Executive Summary
Company overview, mission, vision, value proposition, key metrics.

## Problem & Solution
Detailed problem statement, solution description, product/service overview.

## Market Analysis
TAM/SAM/SOM, target segments, market trends, growth projections.

## Business Model
Revenue streams, pricing strategy, unit economics, cost structure.

## Go-to-Market Strategy
Customer acquisition channels, marketing plan, sales strategy, partnerships.

## Competitive Analysis
Key competitors, differentiation, competitive advantages.

## Team
Current team, key hires needed, advisory board.

## Financial Projections
3-year revenue projections, key expenses, break-even analysis, funding requirements.

## Milestones & Timeline
Key milestones for next 12-24 months with dates and success metrics.

## Risk Analysis
Key risks and mitigation strategies.

Write in a professional tone suitable for investors and stakeholders.`,
    fields: [
      { key: "Startup", label: "Startup Description", placeholder: "Describe your startup, problem you solve, and target customer", type: "textarea", required: true },
      { key: "Industry", label: "Industry", placeholder: "e.g., B2B SaaS, Consumer, HealthTech", type: "input" },
      { key: "Stage", label: "Current Stage", placeholder: "Select stage", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "mvp", label: "MVP" }, { value: "launched", label: "Launched" }, { value: "growth", label: "Growth" }] },
      { key: "Funding Goal", label: "Funding Goal", placeholder: "e.g., $2M Seed to hire 5 engineers", type: "input" },
    ],
  },
}

// ─── Tool runner ─────────────────────────────────────────────────────────────

export async function runTool(toolId: string, inputs: Record<string, string>): Promise<string> {
  const tool = TOOLS[toolId]
  if (!tool) throw new Error(`Unknown tool: ${toolId}`)

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured")

  const userInput = Object.entries(inputs)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: tool.systemPrompt,
    prompt: userInput,
    maxTokens: 6000,
    temperature: 0.4,
  })

  if (!text) throw new Error("Empty response from AI")
  return text
}

// ─── Agent-to-tools mapping (for delegation) ─────────────────────────────────

export const AGENT_TOOLS: Record<string, string[]> = {
  cbs: ["opportunity-scanner"],
  cro: ["competition-advanced"],
  cmo: ["global-events", "internationalisation"],
  cfo: ["financial-engineering", "funding-readiness", "funding-strategy", "cap-table", "startup-credits"],
  coo: ["llc-formation", "legal-requirements", "recruiting", "business-plan"],
}

export const AGENT_LABELS: Record<string, string> = {
  cbs: "Chief Business Strategist",
  cro: "Chief Research Officer",
  cmo: "Chief Marketing Officer",
  cfo: "Chief Financial Officer",
  coo: "Chief Operating Officer",
}
