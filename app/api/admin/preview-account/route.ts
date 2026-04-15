/**
 * GET /api/admin/preview-account?token=<claimToken>
 *
 * Read-only admin endpoint. Returns the company profile and pre-seeded
 * ai_outputs for a seeded invite so Nandine can preview exactly what the
 * founder will see before sending the claim link. No mutations.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"

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

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const { searchParams } = new URL(req.url)
  const token = searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 })
  }

  // Look up the seeded invite
  const inviteSelect =
    "id, target_email, target_name, target_company, seeded_at, email_sent_at, claimed_at, email_preview, user_id, organization_id"
  const legacyInviteSelect =
    "id, target_email, target_name, target_company, seeded_at, email_sent_at, claimed_at, email_preview, user_id"

  let invite: Record<string, unknown> | null = null
  let inviteError: { message: string } | null = null
  {
    const primary = await supabaseAdmin
      .from("seeded_invites")
      .select(inviteSelect)
      .eq("token", token)
      .maybeSingle()

    if (primary.error && /organization_id/i.test(primary.error.message)) {
      const fallback = await supabaseAdmin
        .from("seeded_invites")
        .select(legacyInviteSelect)
        .eq("token", token)
        .maybeSingle()
      invite = (fallback.data as unknown as Record<string, unknown> | null) ?? null
      inviteError = fallback.error ? { message: fallback.error.message } : null
    } else {
      invite = (primary.data as unknown as Record<string, unknown> | null) ?? null
      inviteError = primary.error ? { message: primary.error.message } : null
    }
  }

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 })
  }

  const userId = invite.user_id as string
  const organizationId =
    typeof invite.organization_id === "string" && invite.organization_id.trim()
      ? invite.organization_id
      : null

  // Fetch the seeded company profile
  const profileQuery = supabaseAdmin
    .from("company_profile")
    .select(
      "company_name, tagline, company_description, problem, solution, target_market, stage, vertical, business_model, traction, founder_name, founder_background, icp, competitors, priorities, risks, keywords, knowledge_base_md",
    )

  const { data: profile } = organizationId
    ? await profileQuery.eq("organization_id", organizationId).maybeSingle()
    : await profileQuery.eq("user_id", userId).maybeSingle()

  // Fetch pre-seeded ai_outputs (prefer org-scoped outputs when available).
  const outputsQuery = supabaseAdmin
    .from("ai_outputs")
    .select("id, tool, title, output, created_at")
    .eq("user_id", userId)
    .in("tool", ["daily_brief", "content_linkedin", "competitor-snapshot"])
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: outputs } = organizationId
    ? await outputsQuery.contains("inputs", { organization_id: organizationId })
    : await outputsQuery

  return NextResponse.json({
    invite: {
      id: invite.id,
      email: invite.target_email,
      name: invite.target_name,
      company: invite.target_company,
      seededAt: invite.seeded_at,
      emailSentAt: invite.email_sent_at,
      claimedAt: invite.claimed_at,
      emailPreview: invite.email_preview,
    },
    profile: profile ?? null,
    outputs: outputs ?? [],
  })
}
