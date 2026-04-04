import { NextRequest, NextResponse } from "next/server"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { ensurePersonalOrganization } from "@/lib/organizations"
import { saveVaultKnowledgeEntry } from "@/lib/vault-knowledge"
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

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string") return v.trim() || null
  return String(v)
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
}

async function pushGithubOnboardingSummary(params: {
  repo: string
  token: string
  branch: string
  path: string
  markdown: string
  message: string
}): Promise<void> {
  const { repo, token, branch, path, markdown, message } = params
  const base = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  }

  let sha: string | undefined
  const getRes = await fetch(`${base}?ref=${encodeURIComponent(branch)}`, { headers })
  if (getRes.ok) {
    const j = (await getRes.json()) as { sha?: string }
    sha = j.sha
  }

  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(markdown, "utf8").toString("base64"),
    branch,
  }
  if (sha) body.sha = sha

  const putRes = await fetch(base, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  })
  if (!putRes.ok) {
    const t = await putRes.text()
    console.warn("[onboarding] GitHub vault push failed:", putRes.status, t)
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    transcript?: string
    scrapedData?: Record<string, unknown> | null
    founderName?: string
  }

  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : ""
  if (!transcript) {
    return NextResponse.json({ error: "Missing transcript" }, { status: 400 })
  }

  if (!isLlmConfigured()) {
    return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 500 })
  }

  const scrapedData = body.scrapedData ?? null
  const founderName = typeof body.founderName === "string" ? body.founderName.trim() : ""

  const { text: extractedText } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 3000,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`Extract structured company data from this onboarding conversation.
The founder's name is ${founderName || "unknown"}.

CONVERSATION TRANSCRIPT:
${transcript}

${scrapedData ? `SCRAPED WEBSITE DATA:\n${JSON.stringify(scrapedData, null, 2)}` : ""}

Return a JSON object with these fields (use null for anything not discussed):

{
  "company": {
    "name": "string",
    "description": "2-3 sentence description in the founder's own framing",
    "problem": "the problem they're solving, in their words",
    "solution": "their solution/product description",
    "market": "target market description",
    "vertical": "industry vertical",
    "business_model": "how they make money",
    "stage": "pre-seed | seed | series-a | growth | other",
    "traction": "current traction (revenue, users, etc)"
  },
  "founder": {
    "name": "string",
    "background": "relevant background and expertise",
    "email": "if mentioned"
  },
  "strategy": {
    "thesis": "their core thesis — why this, why now",
    "icp": ["ideal customer profile descriptions"],
    "competitors": ["competitor names"],
    "differentiators": "what makes them different",
    "priorities_90d": ["top 3 priorities for next 90 days"],
    "risks": ["what worries them"],
    "keywords": ["keywords and topics to monitor"]
  },
  "voice": {
    "tone": "how the founder communicates (direct, analytical, passionate, etc)",
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
  const voice = extracted.voice ?? {}

  const scrapedName = scrapedData && typeof scrapedData.name === "string" ? scrapedData.name : null
  const scrapedDesc =
    scrapedData && typeof scrapedData.description === "string" ? scrapedData.description : null
  const scrapedMarket =
    scrapedData && typeof scrapedData.target_market === "string" ? scrapedData.target_market : null
  const scrapedIndustry =
    scrapedData && typeof scrapedData.industry === "string" ? scrapedData.industry : null

  const companyName = asString(company.name) ?? scrapedName
  const companyDescription = asString(company.description) ?? scrapedDesc
  const vertical = asString(company.vertical) ?? scrapedIndustry
  const industry = asString(company.vertical) ?? scrapedIndustry

  const priorities90 = asStringArray(strategy.priorities_90d)
  const risksList = asStringArray(strategy.risks)

  const organization = await ensurePersonalOrganization(user.id)

  const profileData = {
    user_id: user.id,
    organization_id: organization.id,
    company_name: companyName,
    company_description: companyDescription,
    tagline: companyDescription ? companyDescription.slice(0, 500) : null,
    problem: asString(company.problem),
    solution: asString(company.solution),
    target_market: asString(company.market) ?? scrapedMarket,
    industry,
    vertical,
    business_model: asString(company.business_model),
    stage: asString(company.stage),
    traction: asString(company.traction),
    founder_name: asString(founder.name) ?? (founderName || null),
    founder_background: asString(founder.background),
    thesis: asString(strategy.thesis),
    icp: asStringArray(strategy.icp),
    competitors: asStringArray(strategy.competitors),
    keywords: asStringArray(strategy.keywords),
    differentiators: asString(strategy.differentiators),
    priorities: priorities90,
    risks: risksList,
  }

  const { error: profileError } = await supabaseAdmin.from("company_profile").upsert(profileData, {
    onConflict: "user_id",
  })

  if (profileError) {
    console.error("Profile upsert failed:", profileError.message)
  }

  await supabaseAdmin
    .from("company_assets")
    .delete()
    .eq("organization_id", organization.id)
    .eq("type", "document")
    .eq("title", "Onboarding conversation")

  await supabaseAdmin.from("company_assets").insert({
    user_id: user.id,
    organization_id: organization.id,
    type: "document",
    title: "Onboarding conversation",
    content: transcript.slice(0, 100000),
  })

  await supabaseAdmin.from("ai_outputs").insert({
    user_id: user.id,
    tool: "onboarding_extraction",
    title: `Onboarding extraction — ${companyName ?? "Company"}`,
    output: `Structured onboarding extraction for ${companyName ?? "company"}.`,
    inputs: { extracted },
    metadata: {
      completed_at: new Date().toISOString(),
      transcript_length: transcript.length,
      founder_voice: {
        tone: asString(voice.tone),
        vocabulary: asStringArray(voice.vocabulary),
      },
    },
  })

  const vaultToken = process.env.GITHUB_VAULT_TOKEN
  const vaultRepo = process.env.GITHUB_VAULT_REPO
  if (vaultToken && vaultRepo) {
    const branch = process.env.GITHUB_VAULT_BRANCH || "main"
    const path = process.env.GITHUB_VAULT_ONBOARDING_PATH || "juno/onboarding-summary.md"
    const date = new Date().toISOString().split("T")[0]
    const md = [
      `---`,
      `date: ${date}`,
      `type: onboarding`,
      `founder: ${(asString(founder.name) ?? founderName) || "unknown"}`,
      `company: ${companyName ?? "unknown"}`,
      `---`,
      ``,
      `# Onboarding Summary — ${companyName ?? "Company"}`,
      ``,
      `## Company`,
      companyDescription ?? "",
      ``,
      `## Problem`,
      asString(company.problem) ?? "",
      ``,
      `## Solution`,
      asString(company.solution) ?? "",
      ``,
      `## ICP`,
      ...asStringArray(strategy.icp).map((i) => `- ${i}`),
      ``,
      `## Competitors`,
      ...asStringArray(strategy.competitors).map((c) => `- ${c}`),
      ``,
      `## Thesis`,
      asString(strategy.thesis) ?? "",
      ``,
      `## 90-day priorities`,
      ...priorities90.map((p) => `- ${p}`),
      ``,
      `## Risks`,
      ...risksList.map((r) => `- ${r}`),
      ``,
      `## Founder voice`,
      `Tone: ${asString(voice.tone) ?? "not captured"}`,
      `Vocabulary: ${asStringArray(voice.vocabulary).join(", ") || "not captured"}`,
    ].join("\n")

    await pushGithubOnboardingSummary({
      repo: vaultRepo,
      token: vaultToken,
      branch,
      path,
      markdown: md,
      message: `Juno: Onboarding summary for ${companyName ?? "company"}`,
    }).catch(() => {})
  }

  const vaultWrite = await saveVaultKnowledgeEntry({
    content: [
      `Founder: ${(asString(founder.name) ?? founderName) || "unknown"}`,
      `Company: ${companyName ?? "unknown"}`,
      "",
      "## Company",
      companyDescription ?? "",
      "",
      "## Problem",
      asString(company.problem) ?? "",
      "",
      "## Solution",
      asString(company.solution) ?? "",
      "",
      "## ICP",
      ...asStringArray(strategy.icp).map((item) => `- ${item}`),
      "",
      "## Competitors",
      ...asStringArray(strategy.competitors).map((item) => `- ${item}`),
      "",
      "## Thesis",
      asString(strategy.thesis) ?? "",
      "",
      "## 90-day priorities",
      ...priorities90.map((item) => `- ${item}`),
      "",
      "## Risks",
      ...risksList.map((item) => `- ${item}`),
    ]
      .filter(Boolean)
      .join("\n"),
    title: `Onboarding Summary - ${companyName ?? "Company"}`,
    userId: user.id,
    path: process.env.GITHUB_VAULT_ONBOARDING_PATH?.trim() || "company/onboarding-summary.md",
    noteType: "onboarding_summary",
  }).catch((error) => ({
    success: false as const,
    error: error instanceof Error ? error.message : String(error),
  }))

  return NextResponse.json({
    success: true,
    extracted,
    profileSaved: !profileError,
    vaultSynced: Boolean(vaultWrite?.success),
    vaultError: vaultWrite?.success ? null : (vaultWrite?.error ?? null),
  })
}
