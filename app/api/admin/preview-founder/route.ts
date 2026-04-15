/**
 * POST /api/admin/preview-founder
 *
 * Lightweight research-only call — no user created, no DB written.
 * Returns a structured preview so you can sanity-check the target
 * before committing to a full seed.
 *
 * Fast: ~30s (parallel Exa searches + one LLM synthesis pass).
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { researchFounder } from "@/lib/seed-account/researcher"
import { synthesizeFromResearch } from "@/lib/seed-account/synthesizer"

export const maxDuration = 120
export const dynamic = "force-dynamic"

function normalizeDomain(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return ""

  const withoutProtocol = raw.replace(/^https?:\/\//, "")
  const hostOnly = withoutProtocol.split("/")[0]?.trim() ?? ""
  const cleaned = hostOnly.replace(/^www\./, "").replace(/:\d+$/, "")
  if (!cleaned) return ""
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) return ""
  return cleaned
}

function urlMatchesDomain(urlValue: string, domain: string): boolean {
  try {
    const host = normalizeDomain(new URL(urlValue).hostname)
    return host === domain || host.endsWith(`.${domain}`)
  } catch {
    return false
  }
}

async function requireAdmin(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && user.email?.toLowerCase() !== adminEmail) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { userId: user.id }
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const founderName     = typeof body.founderName     === "string" ? body.founderName.trim()     : ""
  const companyName     = typeof body.companyName     === "string" ? body.companyName.trim()     : ""
  const companyUrl      = typeof body.companyUrl      === "string" ? body.companyUrl.trim()      : ""
  const companyDomain   =
    normalizeDomain(typeof body.companyDomain === "string" ? body.companyDomain : undefined) ||
    normalizeDomain(companyUrl)
  const linkedinUrl     = typeof body.linkedinUrl     === "string" ? body.linkedinUrl.trim()     : undefined
  const knowledgeBaseMd = typeof body.knowledgeBaseMd === "string" ? body.knowledgeBaseMd.trim() : undefined

  if (!founderName || !companyName || !companyUrl) {
    return NextResponse.json({ error: "founderName, companyName, companyUrl required" }, { status: 400 })
  }

  if (!companyDomain) {
    return NextResponse.json({ error: "A valid startup domain is required (e.g. basis.com)." }, { status: 400 })
  }

  if (!urlMatchesDomain(companyUrl, companyDomain)) {
    return NextResponse.json(
      { error: "Company URL must match the startup domain you entered." },
      { status: 400 },
    )
  }

  try {
    let synthesis: import("@/lib/seed-account/synthesizer").SynthesisResult

    if (knowledgeBaseMd) {
      const { synthesizeFromKnowledgeBase } = await import("@/lib/seed-account/synthesizer")
      synthesis = await synthesizeFromKnowledgeBase({ founderName, companyName, companyUrl, knowledgeBaseMd })
    } else {
      const bundle = await researchFounder({
        targetEmail: "preview@placeholder.com",
        founderName, companyName, companyUrl, companyDomain, linkedinUrl,
      })
      synthesis = await synthesizeFromResearch(bundle)
    }
    const { profile, emailPreview } = synthesis

    return NextResponse.json({
      profile: {
        company_name:       profile.company_name,
        tagline:            profile.tagline,
        company_description: profile.company_description,
        problem:            profile.problem,
        solution:           profile.solution,
        stage:              profile.stage,
        vertical:           profile.vertical,
        business_model:     profile.business_model,
        traction:           profile.traction,
        thesis:             profile.thesis,
        founder_name:       profile.founder_name,
        founder_background: profile.founder_background,
        founder_location:   profile.founder_location,
        icp:                profile.icp,
        competitors:        profile.competitors,
        keywords:           profile.keywords,
        priorities:         profile.priorities,
        risks:              profile.risks,
      },
      emailPreview,
      knowledgeBasePreview: profile.knowledge_base_md.slice(0, 800) + (profile.knowledge_base_md.length > 800 ? "…" : ""),
    })
  } catch (err: unknown) {
    console.error("[preview-founder]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed" },
      { status: 500 },
    )
  }
}
