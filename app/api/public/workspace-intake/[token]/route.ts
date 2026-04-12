import { convert } from "html-to-text"
import { NextResponse } from "next/server"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { supabaseAdmin } from "@/lib/supabase"
import { getWorkspaceRecordByShareToken } from "@/lib/workspaces"
import { generateText } from "ai"

function extractJsonObject(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return {}
  }
}

function asString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }
  return String(value)
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return null
  return trimmed
}

async function fetchWebsiteText(url: string | null): Promise<string | null> {
  if (!url) return null

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Juno.ai/1.0 (shared intake scraper)" },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) return null

    const html = await response.text()
    const text = convert(html, {
      wordwrap: 130,
      selectors: [{ selector: "a", format: "inline" }],
    })

    const normalized = text.replace(/\s+/g, " ").trim()
    return normalized ? normalized.slice(0, 9000) : null
  } catch {
    return null
  }
}

type IntakePayload = {
  contactName?: string
  contactEmail?: string
  founderName?: string
  companyName?: string
  websiteUrl?: string
  companyDescription?: string
  problem?: string
  solution?: string
  targetMarket?: string
  businessModel?: string
  traction?: string
  differentiators?: string
  contextNotes?: string
  knowledgeBaseMd?: string  // full LLM export / Obsidian vault content
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const workspace = await getWorkspaceRecordByShareToken(token)

  if (!workspace) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      displayName: workspace.displayName,
      companyName: workspace.companyName,
      contactName: workspace.contactName,
      contactEmail: workspace.contactEmail,
      contextStatus: workspace.contextStatus,
    },
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    const workspace = await getWorkspaceRecordByShareToken(token)

    if (!workspace) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as IntakePayload
    const knowledgeBaseMd = typeof body.knowledgeBaseMd === "string"
      ? body.knowledgeBaseMd.trim().slice(0, 200000)  // 200k char cap
      : null

    const payload = {
      contactName: asString(body.contactName),
      contactEmail: asString(body.contactEmail),
      founderName: asString(body.founderName),
      companyName: asString(body.companyName),
      websiteUrl: normalizeUrl(body.websiteUrl),
      companyDescription: asString(body.companyDescription),
      problem: asString(body.problem),
      solution: asString(body.solution),
      targetMarket: asString(body.targetMarket),
      businessModel: asString(body.businessModel),
      traction: asString(body.traction),
      differentiators: asString(body.differentiators),
      contextNotes: asString(body.contextNotes),
    }

    const hasContext = Object.values(payload).some(Boolean)
    if (!hasContext) {
      return NextResponse.json(
        { error: "Please add at least some company context before submitting." },
        { status: 400 },
      )
    }

    await supabaseAdmin
      .from("client_workspaces")
      .update({
        context_status: "intake_started",
        contact_name: payload.contactName ?? workspace.contactName,
        contact_email: payload.contactEmail ?? workspace.contactEmail,
      })
      .eq("id", workspace.id)

    const websiteText = await fetchWebsiteText(payload.websiteUrl)

    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
    }

    const { text: extractedText } = await generateText({
      model: qwenModel(),
      maxOutputTokens: 3000,
      messages: [
        {
          role: "user",
          content: appendWritingRules(`Extract structured company data from this shared client intake.
Use only the information provided. Do not invent metrics, traction, or credentials.
${knowledgeBaseMd ? "A full knowledge base document has been provided — treat it as the highest-fidelity source." : ""}

INTAKE FORM:
${JSON.stringify(payload, null, 2)}

${websiteText ? `WEBSITE TEXT:\n${websiteText}` : "WEBSITE TEXT: none"}

${knowledgeBaseMd ? `KNOWLEDGE BASE DOCUMENT (uploaded by founder):\n${knowledgeBaseMd.slice(0, 12000)}` : ""}

Return JSON only in this shape:
{
  "company": {
    "name": "string",
    "description": "2-3 sentence description in the founder's framing",
    "problem": "the problem they are solving",
    "solution": "their product or service",
    "market": "target market description",
    "vertical": "industry vertical",
    "business_model": "how they make money",
    "stage": "pre-seed | seed | series-a | growth | other",
    "traction": "current traction"
  },
  "founder": {
    "name": "string",
    "background": "relevant background and expertise",
    "email": "if available"
  },
  "strategy": {
    "thesis": "their core thesis, why this and why now",
    "icp": ["ideal customer profile descriptions"],
    "competitors": ["competitor names"],
    "differentiators": "what makes them different",
    "priorities_90d": ["top priorities for the next 90 days"],
    "risks": ["main worries or execution risks"],
    "keywords": ["topics and keywords to monitor"]
  },
  "voice": {
    "tone": "how they sound",
    "vocabulary": ["terms and phrases they use naturally"]
  }
}`),
        },
      ],
    })

    const extracted = extractJsonObject(extractedText) as {
      company?: Record<string, unknown>
      founder?: Record<string, unknown>
      strategy?: Record<string, unknown>
      voice?: Record<string, unknown>
    }

    const company = extracted.company ?? {}
    const founder = extracted.founder ?? {}
    const strategy = (extracted.strategy ?? {}) as Record<string, unknown>

    const companyName = asString(company.name) ?? payload.companyName
    const companyDescription = asString(company.description) ?? payload.companyDescription
    const priorities = asStringArray(strategy.priorities_90d)
    const risks = asStringArray(strategy.risks)

    const profileData = {
      workspace_id: workspace.id,
      owner_user_id: workspace.ownerUserId,
      company_name: companyName,
      company_description: companyDescription,
      tagline: companyDescription ? companyDescription.slice(0, 500) : null,
      problem: asString(company.problem) ?? payload.problem,
      solution: asString(company.solution) ?? payload.solution,
      target_market: asString(company.market) ?? payload.targetMarket,
      industry: asString(company.vertical),
      vertical: asString(company.vertical),
      business_model: asString(company.business_model) ?? payload.businessModel,
      stage: asString(company.stage),
      traction: asString(company.traction) ?? payload.traction,
      founder_name: asString(founder.name) ?? payload.founderName ?? payload.contactName,
      founder_background: asString(founder.background),
      founder_location: null,
      thesis: asString(strategy.thesis),
      icp: asStringArray(strategy.icp),
      competitors: asStringArray(strategy.competitors),
      keywords: asStringArray(strategy.keywords),
      differentiators: asString(strategy.differentiators) ?? payload.differentiators,
      priorities,
      risks,
      // If a full context doc was uploaded, store it as the knowledge base
      // so every agent in this workspace reads it immediately
      ...(knowledgeBaseMd ? {
        knowledge_base_md: knowledgeBaseMd,
        knowledge_base_updated_at: new Date().toISOString(),
      } : {}),
    }

    const { error: profileError } = await supabaseAdmin
      .from("client_workspace_profiles")
      .upsert(profileData, { onConflict: "workspace_id" })

    if (profileError) {
      throw new Error(profileError.message)
    }

    await supabaseAdmin
      .from("client_workspace_assets")
      .delete()
      .eq("owner_user_id", workspace.ownerUserId)
      .eq("workspace_id", workspace.id)
      .eq("title", "Shared intake submission")

    const intakeMarkdown = [
      `Contact name: ${payload.contactName ?? "—"}`,
      `Contact email: ${payload.contactEmail ?? "—"}`,
      `Founder name: ${payload.founderName ?? "—"}`,
      `Company: ${payload.companyName ?? "—"}`,
      `Website: ${payload.websiteUrl ?? "—"}`,
      "",
      "## Description",
      payload.companyDescription ?? "",
      "",
      "## Problem",
      payload.problem ?? "",
      "",
      "## Solution",
      payload.solution ?? "",
      "",
      "## Target market",
      payload.targetMarket ?? "",
      "",
      "## Business model",
      payload.businessModel ?? "",
      "",
      "## Traction",
      payload.traction ?? "",
      "",
      "## Differentiators",
      payload.differentiators ?? "",
      "",
      "## Additional context",
      payload.contextNotes ?? "",
    ]
      .filter(Boolean)
      .join("\n")

    await supabaseAdmin.from("client_workspace_assets").insert({
      workspace_id: workspace.id,
      owner_user_id: workspace.ownerUserId,
      type: "document",
      title: "Shared intake submission",
      content: intakeMarkdown.slice(0, 100000),
    })

    if (websiteText && payload.websiteUrl) {
      await supabaseAdmin
        .from("client_workspace_assets")
        .delete()
        .eq("owner_user_id", workspace.ownerUserId)
        .eq("workspace_id", workspace.id)
        .eq("type", "scraped_url")

      await supabaseAdmin.from("client_workspace_assets").insert({
        workspace_id: workspace.id,
        owner_user_id: workspace.ownerUserId,
        type: "scraped_url",
        title: companyName || payload.websiteUrl,
        source_url: payload.websiteUrl,
        content: websiteText.slice(0, 100000),
      })
    }

    const submittedAt = new Date().toISOString()
    await supabaseAdmin
      .from("client_workspaces")
      .update({
        contact_name: payload.contactName ?? workspace.contactName,
        contact_email: payload.contactEmail ?? workspace.contactEmail,
        company_name: companyName,
        context_status: "ready",
        last_context_submitted_at: submittedAt,
      })
      .eq("id", workspace.id)

    return NextResponse.json({
      success: true,
      companyName,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        displayName: workspace.displayName,
      },
    })
  } catch (error) {
    console.error("[public/workspace-intake] POST:", error)
    return NextResponse.json({ error: "Failed to save context" }, { status: 500 })
  }
}
