import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getCompanyContext } from "@/lib/company-context"
import { buildApolloPeopleSearchUrl } from "@/lib/apollo-search-url"
import { analyseConversionForLookalike } from "@/lib/juno/ai-engine"
import { initialStatsRow } from "@/lib/lookalike/stats"

export const maxDuration = 120

async function resolveUserId(req: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const authHeader = req.headers.get("authorization")
  const secret =
    process.env.JUNO_LEADS_IMPORT_SECRET?.trim() || process.env.JUNO_EXTENSION_API_KEY?.trim()
  const testUserId = process.env.JUNO_TEST_USER_ID?.trim()

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim()
    if (!secret) {
      return {
        error: NextResponse.json(
          { error: "Server missing JUNO_LEADS_IMPORT_SECRET (or JUNO_EXTENSION_API_KEY)" },
          { status: 503 },
        ),
      }
    }
    if (token !== secret) {
      return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) }
    }
    if (!testUserId) {
      return {
        error: NextResponse.json(
          { error: "Server missing JUNO_TEST_USER_ID for extension calls" },
          { status: 503 },
        ),
      }
    }
    return { userId: testUserId }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId: user.id }
}

async function loadLeadSnippets(
  userId: string,
): Promise<Array<{ company: string; role: string; contactName?: string }>> {
  const { data: rows } = await supabaseAdmin
    .from("ai_outputs")
    .select("inputs")
    .eq("user_id", userId)
    .eq("tool", "lead_discovered")
    .order("created_at", { ascending: false })
    .limit(60)

  const out: Array<{ company: string; role: string; contactName?: string }> = []
  for (const row of rows ?? []) {
    const inputs = row.inputs as Record<string, unknown> | null
    if (!inputs) continue
    const company = String(inputs.company ?? "").trim()
    const role = String(inputs.role ?? "").trim()
    const rawName =
      String(inputs.contactName ?? inputs.contact_name ?? inputs.person_name ?? inputs.personName ?? "").trim() ||
      undefined
    if (company && role) out.push({ company, role, contactName: rawName })
  }
  return out
}

/**
 * POST /api/leads/analyse-conversion
 * Body: { name, title, company, location?, whyItWorked?, channel?, responseTime? }
 * Returns lookalike profile, queries, templates, insights — Claude-powered.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  const { userId } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const name = String(body.name ?? "").trim()
  const title = String(body.title ?? "").trim()
  const company = String(body.company ?? "").trim()
  if (!name || !title || !company) {
    return NextResponse.json({ error: "name, title, and company are required" }, { status: 400 })
  }

  const location = typeof body.location === "string" ? body.location.trim() : undefined
  const whyItWorked = typeof body.whyItWorked === "string" ? body.whyItWorked.trim() : undefined
  const channel = typeof body.channel === "string" ? body.channel.trim() : undefined
  const responseTime = typeof body.responseTime === "string" ? body.responseTime.trim() : undefined
  const companyType = typeof body.companyType === "string" ? body.companyType.trim() : undefined
  const industry = typeof body.industry === "string" ? body.industry.trim() : undefined
  const companySizeHint = typeof body.companySize === "string" ? body.companySize.trim() : undefined

  const context = await getCompanyContext(userId, {
    queryHint: "GTM ICP lookalike conversion outreach",
  })
  if (!context) {
    return NextResponse.json({ error: "No company profile for this user" }, { status: 400 })
  }

  const existingLeadSnippets = await loadLeadSnippets(userId)

  const result = await analyseConversionForLookalike({
    context,
    conversion: {
      name,
      title,
      company,
      location,
      whyItWorked,
      channel,
      responseTime,
      companyType,
      industry,
      companySize: companySizeHint,
    },
    existingLeadSnippets,
  })

  const apolloFallback = buildApolloPeopleSearchUrl({
    targetTitles: result.lookalike.targetTitles,
    companyTypes: result.lookalike.companyTypes,
    geography: result.lookalike.geography,
    companySize: result.lookalike.companySize,
  })

  result.searchQueries = {
    ...result.searchQueries,
    apolloAppUrl: result.searchQueries.apolloAppUrl?.trim() || apolloFallback,
  }

  let lookalikeProfileId: string | null = null
  if (result.dimensions && result.outreachPlaybook) {
    try {
      const { data, error } = await supabaseAdmin
        .from("lookalike_profiles")
        .insert({
          user_id: userId,
          name: (result.profileName ?? `Lookalike — ${name}`).slice(0, 500),
          segment_tag: result.segmentTag,
          created_from_conversion_id: null,
          dimensions: result.dimensions,
          outreach_playbook: result.outreachPlaybook,
          stats: initialStatsRow(),
          queries_cache: result.platformQueries ?? null,
          is_active: true,
        })
        .select("id")
        .single()
      if (error) {
        console.error("[analyse-conversion] lookalike_profiles:", error.message)
      } else if (data?.id) {
        lookalikeProfileId = data.id
      }
    } catch (e) {
      console.error("[analyse-conversion] lookalike_profiles insert:", e)
    }
  }

  return NextResponse.json({ ...result, lookalikeProfileId })
}
