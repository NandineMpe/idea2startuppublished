import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getCompanyContext } from "@/lib/company-context"
import {
  generateOutreach,
  personalizeDistributionLead,
  scoreLeadFit,
} from "@/lib/juno/ai-engine"
import { inngest } from "@/lib/inngest/client"
import { saveLeadToDB } from "@/lib/juno/delivery"
import { resolveDomainForTheOrgLookup } from "@/lib/juno/theorg"
import { normalizeDimensions } from "@/lib/lookalike/normalize"
import { heuristicToPercent, scoreLeadAgainstProfile } from "@/lib/lookalike/score-lead"
import type { LookalikeDimensions } from "@/types/lookalike"

/** Keep low so each job’s score + outreach fit within typical serverless limits. */
const MAX_JOBS_PER_REQUEST = 5

/** Distribution CSV / web: one Claude call per row — keep batch small. */
const MAX_DISTRIBUTION_LEADS_PER_REQUEST = 8

/** Apollo extension: slightly larger batches (same maxDuration). */
const MAX_APOLLO_DISTRIBUTION_LEADS_PER_REQUEST = 12

export const maxDuration = 120

type ImportJob = {
  company: string
  role: string
  description: string
  url: string
  location?: string
  salary?: string
  sourceId?: string
}

function leadDedupeKey(company: string, role: string): string {
  return `${company.toLowerCase().trim()}|${role.toLowerCase().trim()}`
}

/** Reject Jack & Jill UI chrome mistaken for company/role (nav + action bar). */
function isJunkJackJillScrape(company: string, role: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/^[←→↓\s·|]+/u, "")
      .replace(/\s+/g, " ")
      .trim()
  const c = norm(company)
  const r = norm(role)
  const junkRole = /^(not for me|skip|interested|job post)$/i.test(r) || /\bnot for me\b/i.test(r)
  const junkCompany = /^(home|jobs|profile|search)$/i.test(c)
  if (junkRole) return true
  if (junkCompany && (junkRole || r.length < 3)) return true
  return false
}

function normalizeImportJob(raw: unknown): ImportJob | null {
  if (!raw || typeof raw !== "object") return null
  const j = raw as Record<string, unknown>
  let company = String(j.company ?? "").trim()
  let role = String(j.role ?? "").trim()
  const summary = typeof j.summary === "string" ? j.summary.trim() : ""
  const rt = typeof j.rawText === "string" ? j.rawText.trim() : ""
  const description = (summary || rt || `${company} ${role}`).slice(0, 8000)
  const url = typeof j.url === "string" ? j.url.trim() : ""
  const location = typeof j.location === "string" ? j.location.trim() : undefined
  const salary = typeof j.salary === "string" ? j.salary.trim() : undefined
  const sourceId = typeof j.sourceId === "string" ? j.sourceId.trim() : undefined

  if ((!company || !role) && rt) {
    const lines = rt.split("\n").map((l) => l.trim()).filter(Boolean)
    if (!company && lines[0]) company = lines[0].slice(0, 160)
    if (!role && lines[1]) role = lines[1].slice(0, 160)
  }
  if (!company) company = "Unknown"
  if (!role) role = "See posting"

  if (isJunkJackJillScrape(company, role)) return null

  return { company, role, description, url, location, salary, sourceId }
}

type DistributionImportJob = {
  company: string
  role: string
  firstName: string
  lastName: string
  location: string
}

function normalizeDistributionJob(raw: unknown): DistributionImportJob | null {
  if (!raw || typeof raw !== "object") return null
  const j = raw as Record<string, unknown>
  const company = String(j.company ?? "").trim()
  const role = String(j.role ?? j.title ?? "").trim()
  let firstName = String(j.firstName ?? j.first_name ?? "").trim()
  let lastName = String(j.lastName ?? j.last_name ?? "").trim()
  const location = String(j.location ?? "").trim()
  const rawText = typeof j.rawText === "string" ? j.rawText.trim() : ""
  if ((!firstName || !lastName) && rawText) {
    const parts = rawText.split(/[\t,]/).map((s) => s.trim()).filter(Boolean)
    if (!firstName && parts[0]) firstName = parts[0].slice(0, 80)
    if (!lastName && parts[1]) lastName = parts[1].slice(0, 80)
  }
  if (!company || !role) return null
  return { company, role, firstName, lastName, location }
}

async function resolveUserId(req: NextRequest): Promise<
  | { userId: string }
  | { error: NextResponse }
> {
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
          { error: "Server missing JUNO_TEST_USER_ID for extension imports" },
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

async function loadExistingLeadKeys(userId: string): Promise<Set<string>> {
  const { data: rows } = await supabaseAdmin
    .from("ai_outputs")
    .select("inputs")
    .eq("user_id", userId)
    .eq("tool", "lead_discovered")
    .limit(500)

  const keys = new Set<string>()
  for (const row of rows ?? []) {
    const inputs = row.inputs as Record<string, unknown> | null
    if (!inputs) continue
    const c = String(inputs.company ?? "")
    const r = String(inputs.role ?? "")
    if (c && r) keys.add(leadDedupeKey(c, r))
  }
  return keys
}

async function mergeJackJillJobs(
  userId: string,
  items: Array<{ company: string; title: string; url: string; description: string }>,
): Promise<void> {
  if (items.length === 0) return
  const { ensurePersonalOrganization } = await import("@/lib/organizations")
  const org = await ensurePersonalOrganization(userId)
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("company_profile")
    .select("jack_jill_jobs")
    .eq("organization_id", org.id)
    .maybeSingle()

  if (fetchErr || !row) return

  const raw = Array.isArray(row.jack_jill_jobs) ? row.jack_jill_jobs : []
  const merged: Array<{ company: string; title: string; url: string; description: string }> = []
  const seen = new Set<string>()

  for (const x of raw) {
    if (!x || typeof x !== "object") continue
    const o = x as Record<string, unknown>
    const company = String(o.company ?? "").trim()
    const title = String(o.title ?? "").trim()
    if (!company || !title) continue
    const k = leadDedupeKey(company, title)
    seen.add(k)
    merged.push({
      company,
      title,
      url: typeof o.url === "string" ? o.url : "",
      description: typeof o.description === "string" ? o.description : "",
    })
  }

  for (const it of items) {
    const k = leadDedupeKey(it.company, it.title)
    if (seen.has(k)) continue
    seen.add(k)
    merged.push(it)
  }

  await supabaseAdmin.from("company_profile").update({ jack_jill_jobs: merged }).eq("organization_id", org.id)
}

/**
 * POST /api/leads/import
 * Chrome extension (Bearer JUNO_LEADS_IMPORT_SECRET) or logged-in session.
 * Scores Jack & Jill (or pasted) job rows against company context and saves `lead_discovered` rows.
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

  const source = typeof body.source === "string" ? body.source : "import"
  const isDistribution =
    body.distribution === true || source === "distribution" || source === "apollo_extension"

  let jobsRaw: unknown[] = []
  if (Array.isArray(body.jobs)) {
    jobsRaw = body.jobs
  } else if (typeof body.rawText === "string" && body.rawText.trim()) {
    jobsRaw = [{ rawText: body.rawText.trim(), company: "", role: "" }]
  } else if (typeof body.csvData === "string" && body.csvData.trim()) {
    jobsRaw = [{ rawText: body.csvData.trim(), company: "", role: "" }]
  } else {
    return NextResponse.json({ error: "No jobs provided" }, { status: 400 })
  }

  if (isDistribution) {
    const profile = body.conversionProfile as Record<string, unknown> | undefined
    let rationale = String(profile?.rationale ?? "").trim()
    let multiplierNote = String(profile?.multiplierNote ?? "").trim()
    let pitchAngle = String(profile?.pitchAngle ?? "").trim()
    const templates = profile?.templates as { inmail?: string; coldEmail?: string } | undefined
    let inmail = String(templates?.inmail ?? "").trim()
    let coldEmail = String(templates?.coldEmail ?? "").trim()

    const lookalikeProfileIdRaw =
      typeof body.lookalikeProfileId === "string" ? body.lookalikeProfileId.trim() : ""

    let profileDimensions: LookalikeDimensions | null = null
    let dimensionsJson: string | undefined

    if (lookalikeProfileIdRaw) {
      const { data: lpRow, error: lpErr } = await supabaseAdmin
        .from("lookalike_profiles")
        .select("dimensions, outreach_playbook")
        .eq("id", lookalikeProfileIdRaw)
        .eq("user_id", userId)
        .maybeSingle()

      if (lpErr || !lpRow) {
        return NextResponse.json({ error: "lookalikeProfileId not found" }, { status: 400 })
      }

      profileDimensions = normalizeDimensions(lpRow.dimensions)
      dimensionsJson = JSON.stringify(profileDimensions)
      const pb = lpRow.outreach_playbook as Record<string, unknown> | null
      const mt = pb?.messageTemplate as Record<string, unknown> | undefined
      rationale = String(pb?.rationale ?? rationale).trim()
      pitchAngle = String(pb?.bestAngle ?? pitchAngle).trim()
      inmail = String(mt?.linkedin ?? inmail).trim()
      coldEmail = String(mt?.email ?? coldEmail).trim()
      const mult = profileDimensions.multiplierEffect
      multiplierNote =
        multiplierNote ||
        [
          mult.isMultiplier ? "Multiplier ICP" : "",
          mult.multiplierType ? String(mult.multiplierType) : "",
          mult.estimatedReach != null ? `~${mult.estimatedReach} influenced reach` : "",
        ]
          .filter(Boolean)
          .join(" · ") ||
        "—"
    }

    if (!pitchAngle || !rationale || !inmail || !coldEmail) {
      return NextResponse.json(
        {
          error:
            "distribution import requires conversionProfile: rationale, multiplierNote, pitchAngle, templates.inmail, templates.coldEmail — or a valid lookalikeProfileId",
        },
        { status: 400 },
      )
    }

    const distJobs = jobsRaw.map(normalizeDistributionJob).filter(Boolean) as DistributionImportJob[]
    if (distJobs.length === 0) {
      return NextResponse.json(
        { error: "Could not normalize distribution rows (need company, title/role per row)" },
        { status: 400 },
      )
    }

    const distLimit =
      source === "apollo_extension"
        ? MAX_APOLLO_DISTRIBUTION_LEADS_PER_REQUEST
        : MAX_DISTRIBUTION_LEADS_PER_REQUEST
    const slice = distJobs.slice(0, distLimit)

    const context = await getCompanyContext(userId, {
      queryHint: "lookalike distribution personalized outreach",
    })
    if (!context) {
      return NextResponse.json({ error: "No company profile for this user" }, { status: 400 })
    }

    const results: Array<{
      company: string
      role: string
      firstName: string
      lastName: string
      location: string
      linkedinUrl?: string
      fitScore: number
      personalizedInmail: string
      personalizedEmail: string
    }> = []

    for (const job of slice) {
      try {
        const out = await personalizeDistributionLead({
          context,
          conversion: {
            rationale,
            multiplierNote,
            pitchAngle,
            templateInmail: inmail,
            templateColdEmail: coldEmail,
          },
          dimensionsJson,
          lead: {
            firstName: job.firstName,
            lastName: job.lastName,
            title: job.role,
            company: job.company,
            location: job.location,
          },
        })
        let fitScore = out.fitScore
        if (profileDimensions) {
          const h = heuristicToPercent(
            scoreLeadAgainstProfile(
              {
                title: job.role,
                company: job.company,
                location: job.location,
              },
              profileDimensions,
            ),
          )
          fitScore = Math.round(0.45 * h + 0.55 * out.fitScore)
        }
        results.push({
          company: job.company,
          role: job.role,
          firstName: job.firstName,
          lastName: job.lastName,
          location: job.location,
          fitScore,
          personalizedInmail: out.personalizedInmail,
          personalizedEmail: out.personalizedEmail,
        })
      } catch (e) {
        console.error("[leads/import] personalizeDistributionLead:", e)
      }
    }

    return NextResponse.json({
      mode: "distribution",
      processed: results.length,
      total: distJobs.length,
      truncated: distJobs.length > distLimit,
      results,
    })
  }

  const normalized = jobsRaw.map(normalizeImportJob).filter(Boolean) as ImportJob[]
  if (normalized.length === 0) {
    return NextResponse.json({ error: "Could not normalize any jobs" }, { status: 400 })
  }

  const slice = normalized.slice(0, MAX_JOBS_PER_REQUEST)

  const context = await getCompanyContext(userId, {
    queryHint: "customers hiring ICP job postings outreach",
  })
  if (!context) {
    return NextResponse.json({ error: "No company profile for this user" }, { status: 400 })
  }

  const existingKeys = await loadExistingLeadKeys(userId)

  let imported = 0
  let skippedDuplicates = 0
  let skippedLowScore = 0
  const jackJillMerge: Array<{ company: string; title: string; url: string; description: string }> =
    []

  for (const job of slice) {
    const key = leadDedupeKey(job.company, job.role)
    if (existingKeys.has(key)) {
      skippedDuplicates++
      continue
    }

    let score
    try {
      score = await scoreLeadFit({
        context,
        company: job.company,
        role: job.role,
        description: job.description,
      })
    } catch (e) {
      console.error("[leads/import] scoreLeadFit:", e)
      continue
    }

    if (score.icpFit < 5) {
      skippedLowScore++
      continue
    }

    let outreach
    try {
      outreach = await generateOutreach({
        context,
        company: job.company,
        role: job.role,
        jobUrl: job.url || "https://app.jackandjill.ai/",
        pitchAngle: score.pitchAngle,
      })
    } catch (e) {
      console.error("[leads/import] generateOutreach:", e)
      outreach = { linkedinConnect: "", linkedinDM: "", email: "" }
    }

    const leadId = await saveLeadToDB({
      userId,
      company: job.company,
      role: job.role,
      url: job.url || undefined,
      companyDomain: resolveDomainForTheOrgLookup(
        job.company,
        job.url || undefined,
        source === "jack_and_jill" ? "jack_and_jill" : source,
      ),
      score: score.icpFit,
      pitchAngle: score.pitchAngle,
      source: source === "jack_and_jill" ? "jack_and_jill" : source,
      timing: score.timing,
      budgetSignal: score.budgetSignal,
      jobLocation: job.location,
      jobSalary: job.salary,
      linkedinConnect: outreach.linkedinConnect,
      linkedinDM: outreach.linkedinDM,
      email: outreach.email,
    })

    if (typeof leadId === "string" && score.icpFit >= 7) {
      try {
        await inngest.send({
          name: "juno/lead.qualified",
          data: {
            leadId,
            userId,
            companyName: job.company,
            companyDomain: resolveDomainForTheOrgLookup(
              job.company,
              job.url || undefined,
              source === "jack_and_jill" ? "jack_and_jill" : source,
            ),
            jobTitle: job.role,
            jobUrl: job.url || undefined,
            pitchAngle: score.pitchAngle,
            score: score.icpFit,
            source: source === "jack_and_jill" ? "jack_and_jill" : source,
          },
        })
      } catch (e) {
        console.error("[leads/import] juno/lead.qualified:", e)
      }
    }

    imported++
    existingKeys.add(key)
    jackJillMerge.push({
      company: job.company,
      title: job.role,
      url: job.url || "",
      description: job.description.slice(0, 3000),
    })
  }

  if (imported > 0 && source === "jack_and_jill") {
    await mergeJackJillJobs(userId, jackJillMerge)
  }

  return NextResponse.json({
    imported,
    total: slice.length,
    skippedDuplicates,
    skippedLowScore,
    truncated: normalized.length > MAX_JOBS_PER_REQUEST,
  })
}
