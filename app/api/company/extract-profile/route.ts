import { NextResponse } from "next/server"
import { generateText } from "ai"
import { isLlmConfigured, LLM_API_KEY_MISSING_MESSAGE, qwenModel } from "@/lib/llm-provider"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveOrganizationSelection } from "@/lib/organizations"
import { resolveWorkspaceSelection } from "@/lib/workspaces"
import { jsonApiError } from "@/lib/api-error-response"

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function asStr(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t || null
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean)
}

export async function POST(request: Request) {
  try {
    if (!isLlmConfigured()) {
      return NextResponse.json({ error: LLM_API_KEY_MISSING_MESSAGE }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const workspace = url.searchParams.get("scope") === "owner"
      ? null
      : await resolveWorkspaceSelection(user.id, { useCookieWorkspace: true })

    const organization = workspace === null
      ? await resolveOrganizationSelection(user.id, { useCookieOrganization: true })
      : null

    // Load the knowledge base markdown
    const { data: row } = workspace
      ? await supabaseAdmin
          .from("client_workspace_profiles")
          .select("knowledge_base_md")
          .eq("owner_user_id", user.id)
          .eq("workspace_id", workspace.id)
          .maybeSingle()
      : organization
        ? await supabaseAdmin
            .from("company_profile")
            .select("knowledge_base_md")
            .eq("organization_id", organization.id)
            .maybeSingle()
        : { data: null }

    const knowledgeMd = (row as Record<string, unknown> | null)?.knowledge_base_md
    if (!knowledgeMd || typeof knowledgeMd !== "string" || !knowledgeMd.trim()) {
      return NextResponse.json(
        { error: "No knowledge base document found. Upload or paste your company markdown first." },
        { status: 400 },
      )
    }

    const { text } = await generateText({
      model: qwenModel(),
      temperature: 0.1,
      prompt: `You are a company profile extractor. Read the markdown document below and extract the company profile into a JSON object.

Return ONLY a valid JSON object with these exact keys (omit keys where information is not clearly stated):
{
  "company_name": "string",
  "tagline": "string — one-line tagline or positioning statement",
  "company_description": "string — 2-4 sentence overview",
  "problem": "string — the core problem being solved",
  "solution": "string — the product/service solution",
  "target_market": "string — the addressable market",
  "industry": "string",
  "vertical": "string",
  "stage": "string — e.g. pre-seed, seed, series-a, etc.",
  "business_model": "string — how the company makes money",
  "traction": "string — key metrics, customers, revenue milestones",
  "thesis": "string — why this, why now",
  "differentiators": "string — what makes this unique vs alternatives",
  "founder_name": "string",
  "founder_location": "string",
  "founder_background": "string",
  "icp": ["string", ...],
  "competitors": ["string", ...],
  "keywords": ["string", ...]
}

Do not invent information. Only extract what is explicitly stated. Return valid JSON only, no markdown fences, no explanation.

DOCUMENT:
${knowledgeMd.slice(0, 14000)}`,
    })

    const extracted = parseJsonObject(text)
    if (!extracted) {
      return NextResponse.json({ error: "LLM did not return valid JSON. Try again." }, { status: 500 })
    }

    // Build the patch — only include fields that were actually extracted
    const patch: Record<string, unknown> = workspace
      ? { owner_user_id: user.id, workspace_id: workspace.id }
      : { user_id: user.id, organization_id: organization?.id }

    const strFields = [
      "company_name", "tagline", "company_description", "problem", "solution",
      "target_market", "industry", "vertical", "stage", "business_model",
      "traction", "thesis", "differentiators", "founder_name", "founder_location",
      "founder_background",
    ] as const

    for (const f of strFields) {
      const v = asStr(extracted[f])
      if (v) patch[f] = v
    }

    const arrFields = ["icp", "competitors", "keywords"] as const
    for (const f of arrFields) {
      const arr = asStringArray(extracted[f])
      if (arr.length > 0) patch[f] = arr
    }

    const table = workspace ? "client_workspace_profiles" : "company_profile"
    const conflictCol = workspace ? "workspace_id" : "organization_id"

    const { error: upsertError } = await supabaseAdmin
      .from(table)
      .upsert(patch, { onConflict: conflictCol })

    if (upsertError) throw upsertError

    return NextResponse.json({ ok: true, extracted: patch })
  } catch (e) {
    return jsonApiError(500, e, "extract-profile POST")
  }
}
