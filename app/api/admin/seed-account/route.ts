/**
 * POST /api/admin/seed-account
 *
 * Triggers the full seed pipeline for one founder:
 *   research → synthesize → seed DB → send email
 *
 * Protected: only callable by authenticated users whose email matches
 * ADMIN_EMAIL env var (i.e. you, Nandine).
 *
 * Body:
 * {
 *   targetEmail: string        // founder's email
 *   founderName: string        // full name
 *   companyName: string        // company name
 *   companyUrl: string         // https://...
 *   companyDomain: string      // e.g. basis.com (can differ from companyUrl host)
 *   organizationSlug: string   // startup account slug (unique)
 *   organizationName?: string  // optional display label (defaults to companyName)
 *   confirmStandalone: true    // explicit safety gate
 *   linkedinUrl?: string       // optional, improves founder profile quality
 *   twitterUrl?: string        // optional
 *   sendEmail?: boolean        // default true — set false to seed without emailing
 * }
 *
 * Response:
 * {
 *   ok: true,
 *   userId, organizationId, claimToken, seededInviteId,
 *   emailSent: boolean,
 *   claimUrl: string
 * }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveAppUrl } from "@/lib/app-url"
import { researchFounder } from "@/lib/seed-account/researcher"
import { synthesizeFromResearch } from "@/lib/seed-account/synthesizer"
import { seedFounderAccount } from "@/lib/seed-account/seeder"
import { sendSeedEmail } from "@/lib/seed-account/email"

export const maxDuration = 300 // 5 min — research + synthesis takes ~2 min
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

function normalizeSlug(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return ""
  return raw
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

function slugLooksValid(value: string): boolean {
  return value.length >= 3 && value.length <= 50 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

// ─── admin guard ──────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && user.email?.toLowerCase() !== adminEmail) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { userId: user.id }
}

// ─── handler ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const targetEmailRaw   = typeof body.targetEmail      === "string" ? body.targetEmail.trim()      : ""
  const targetEmail      = targetEmailRaw.toLowerCase()
  const founderName      = typeof body.founderName      === "string" ? body.founderName.trim()      : ""
  const companyName      = typeof body.companyName      === "string" ? body.companyName.trim()      : ""
  const companyUrl       = typeof body.companyUrl       === "string" ? body.companyUrl.trim()       : ""
  const linkedinUrl      = typeof body.linkedinUrl      === "string" ? body.linkedinUrl.trim()      : undefined
  const twitterUrl       = typeof body.twitterUrl       === "string" ? body.twitterUrl.trim()       : undefined
  const sendEmail        = body.sendEmail !== false
  const confirmStandalone = body.confirmStandalone === true
  const organizationSlug = normalizeSlug(
    typeof body.organizationSlug === "string" ? body.organizationSlug : undefined,
  )
  const organizationNameRaw =
    typeof body.organizationName === "string" ? body.organizationName.trim() : ""
  const organizationName = organizationNameRaw || companyName
  const companyDomain =
    normalizeDomain(typeof body.companyDomain === "string" ? body.companyDomain : undefined) ||
    normalizeDomain(companyUrl)
  const normalizedCompanyUrl = companyUrl || (companyDomain ? `https://${companyDomain}` : "")
  // Pre-built context doc — skips Exa research + LLM synthesis entirely
  const knowledgeBaseMd  = typeof body.knowledgeBaseMd  === "string" ? body.knowledgeBaseMd.trim()  : undefined

  if (!targetEmail || !founderName || !companyName) {
    return NextResponse.json(
      { error: "targetEmail, founderName, and companyName are required" },
      { status: 400 },
    )
  }

  if (!normalizedCompanyUrl) {
    return NextResponse.json(
      { error: "Provide either a website URL or a valid startup domain." },
      { status: 400 },
    )
  }

  if (!companyDomain) {
    return NextResponse.json(
      { error: "A valid startup domain is required (e.g. basis.com)." },
      { status: 400 },
    )
  }

  if (organizationSlug && !slugLooksValid(organizationSlug)) {
    return NextResponse.json(
      {
        error:
          "Organization slug must be 3-50 chars, lowercase letters/numbers, and optional single hyphens.",
      },
      { status: 400 },
    )
  }

  if (!organizationSlug) {
    return NextResponse.json(
      { error: "Organization slug is required to create a standalone startup account." },
      { status: 400 },
    )
  }

  if (!confirmStandalone) {
    return NextResponse.json(
      { error: "Please confirm this should create a standalone tenant before seeding." },
      { status: 400 },
    )
  }

  // Guard: don't double-seed the same email
  const { data: existing } = await supabaseAdmin
    .from("seeded_invites")
    .select("id, claimed_at")
    .eq("target_email", targetEmail)
    .maybeSingle()

  if (existing) {
    const status = existing.claimed_at ? "already_claimed" : "already_seeded"
    return NextResponse.json({ error: `This email has been ${status}`, status }, { status: 409 })
  }

  try {
    let synthesis: import("@/lib/seed-account/synthesizer").SynthesisResult

    if (knowledgeBaseMd) {
      // ── Fast path: pre-built context doc supplied — extract structure from it ──
      const { synthesizeFromKnowledgeBase } = await import("@/lib/seed-account/synthesizer")
      synthesis = await synthesizeFromKnowledgeBase({
        founderName,
        companyName,
        companyUrl: normalizedCompanyUrl,
        knowledgeBaseMd,
      })
    } else {
      // ── Full path: Exa research + LLM synthesis ──
      const bundle = await researchFounder({
        targetEmail,
        founderName,
        companyName,
        companyUrl: normalizedCompanyUrl,
        companyDomain,
        linkedinUrl,
        twitterUrl,
      })
      synthesis = await synthesizeFromResearch(bundle)
    }

    // 3. Seed DB
    const seedResult = await seedFounderAccount(
      {
        targetEmail,
        founderName,
        companyName,
        companyUrl: normalizedCompanyUrl,
        companyDomain,
        linkedinUrl,
        twitterUrl,
      },
      synthesis,
      auth.userId,
      { organizationSlug: organizationSlug || undefined, organizationName, companyDomain },
    )

    // 4. Send email
    let emailSent = false
    let emailError: string | undefined

    if (sendEmail) {
      const emailResult = await sendSeedEmail({
        toEmail: targetEmail,
        founderName: synthesis.profile.founder_name || founderName,
        companyName: synthesis.profile.company_name || companyName,
        claimToken: seedResult.claimToken,
        emailPreview: synthesis.emailPreview,
      })
      emailSent = emailResult.ok
      emailError = emailResult.error

      // Record send timestamp
      if (emailSent) {
        await supabaseAdmin
          .from("seeded_invites")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("id", seedResult.seededInviteId)
      }
    }

    const claimUrl = `${resolveAppUrl()}/claim/${encodeURIComponent(seedResult.claimToken)}`
    const previewUrl = `${resolveAppUrl()}/admin/preview/${encodeURIComponent(seedResult.claimToken)}`

    return NextResponse.json({
      ok: true,
      ...seedResult,
      claimUrl,
      previewUrl,
      emailSent,
      emailError: emailError ?? null,
      profile: {
        company: synthesis.profile.company_name,
        stage: synthesis.profile.stage,
        vertical: synthesis.profile.vertical,
        icp: synthesis.profile.icp.slice(0, 2),
        competitors: synthesis.profile.competitors.slice(0, 3),
      },
    })
  } catch (err: unknown) {
    console.error("[seed-account] pipeline error:", err)
    const message = err instanceof Error ? err.message : "Seed pipeline failed"
    if (/already taken/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}

// ─── GET: list all seeded invites ─────────────────────────────────────────────

type InviteStatus = "seeded" | "claimed" | "trial" | "active" | "expired"

function inferInviteStatus(params: {
  claimedAt: string | null
  seededAt: string
  billingStatus?: string | null
}): InviteStatus {
  if (!params.claimedAt) {
    const seededAtMs = Date.parse(params.seededAt)
    if (Number.isFinite(seededAtMs) && Date.now() - seededAtMs > 30 * 24 * 60 * 60 * 1000) {
      return "expired"
    }
    return "seeded"
  }

  if (params.billingStatus === "on_trial") return "trial"
  if (params.billingStatus === "active" || params.billingStatus === "paid") return "active"
  return "claimed"
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const { data, error } = await supabaseAdmin
    .from("seeded_invites")
    .select(
      "id, user_id, target_email, target_name, target_company, seeded_at, email_sent_at, claimed_at, email_preview, token, organization_id",
    )
    .order("seeded_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const invites = data ?? []

  const organizationIds = [
    ...new Set(
      invites
        .map((invite) => (typeof invite.organization_id === "string" ? invite.organization_id : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const userIds = [
    ...new Set(
      invites
        .map((invite) => (typeof invite.user_id === "string" ? invite.user_id : null))
        .filter((value): value is string => Boolean(value)),
    ),
  ]

  const [organizationRows, billingRows] = await Promise.all([
    organizationIds.length > 0
      ? supabaseAdmin
          .from("organizations")
          .select("id, slug, display_name")
          .in("id", organizationIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length > 0
      ? supabaseAdmin.from("billing_accounts").select("user_id, status").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const organizationById = new Map<string, { slug: string | null; name: string | null }>()
  for (const row of organizationRows.data ?? []) {
    organizationById.set(String(row.id), {
      slug: typeof row.slug === "string" ? row.slug : null,
      name: typeof row.display_name === "string" ? row.display_name : null,
    })
  }

  const billingByUserId = new Map<string, string | null>()
  for (const row of billingRows.data ?? []) {
    billingByUserId.set(String(row.user_id), typeof row.status === "string" ? row.status : null)
  }

  const appUrl = resolveAppUrl()
  const enrichedInvites = invites.map((invite) => {
    const organizationId =
      typeof invite.organization_id === "string" && invite.organization_id.trim()
        ? invite.organization_id
        : null
    const userId = typeof invite.user_id === "string" ? invite.user_id : null
    const organization = organizationId ? organizationById.get(organizationId) : undefined
    const token =
      typeof invite.token === "string" && invite.token.trim() ? invite.token.trim() : null

    return {
      ...invite,
      status: inferInviteStatus({
        claimedAt: typeof invite.claimed_at === "string" ? invite.claimed_at : null,
        seededAt: String(invite.seeded_at ?? ""),
        billingStatus: userId ? billingByUserId.get(userId) ?? null : null,
      }),
      organization_slug: organization?.slug ?? null,
      organization_name: organization?.name ?? null,
      claim_url: token ? `${appUrl}/claim/${encodeURIComponent(token)}` : null,
    }
  })

  return NextResponse.json({ invites: enrichedInvites })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const url = new URL(request.url)
  const inviteId = url.searchParams.get("id")?.trim() ?? ""
  if (!inviteId) {
    return NextResponse.json({ error: "Invite id is required." }, { status: 400 })
  }

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("seeded_invites")
    .select("id, claimed_at")
    .eq("id", inviteId)
    .maybeSingle()

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 })
  }

  if (invite.claimed_at) {
    return NextResponse.json({ error: "Claimed invites cannot be deleted." }, { status: 409 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from("seeded_invites")
    .delete()
    .eq("id", inviteId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
