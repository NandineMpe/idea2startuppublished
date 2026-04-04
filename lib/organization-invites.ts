import { randomBytes } from "node:crypto"
import { supabaseAdmin } from "@/lib/supabase"
import { buildOrganizationInviteAcceptUrl, sendOrganizationInviteEmail } from "@/lib/org-invite-email"
import {
  getMembershipRole,
  getOrganizationByIdForUser,
  type OrganizationRole,
} from "@/lib/organizations"

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function getInviterDisplayName(userId: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error || !data.user) return "A teammate"
    const meta = data.user.user_metadata as Record<string, unknown> | undefined
    const fullName = typeof meta?.full_name === "string" ? meta.full_name.trim() : ""
    if (fullName) return fullName
    const email = data.user.email?.trim()
    if (email) return email.split("@")[0] || "A teammate"
  } catch {
    // ignore
  }
  return "A teammate"
}

export type PendingInvitationRow = {
  id: string
  email: string
  role: OrganizationRole
  expires_at: string
  created_at: string
}

export async function getInvitePreviewByToken(
  token: string,
): Promise<
  | { ok: true; organizationName: string; email: string; expired: boolean; accepted: boolean }
  | { ok: false; error: string }
> {
  const t = token.trim()
  if (!t) {
    return { ok: false, error: "Missing invite link." }
  }

  const { data: invite, error } = await supabaseAdmin
    .from("organization_invitations")
    .select("email, expires_at, accepted_at, organization_id")
    .eq("token", t)
    .maybeSingle()

  if (error || !invite) {
    return { ok: false, error: "This invite link is invalid." }
  }

  const { data: orgRow } = await supabaseAdmin
    .from("organizations")
    .select("display_name")
    .eq("id", invite.organization_id as string)
    .maybeSingle()

  const organizationName =
    typeof orgRow?.display_name === "string" && orgRow.display_name.trim()
      ? orgRow.display_name
      : "Team"

  return {
    ok: true,
    organizationName,
    email: invite.email as string,
    expired: new Date(invite.expires_at as string).getTime() < Date.now(),
    accepted: invite.accepted_at != null,
  }
}

export async function listPendingInvitations(organizationId: string): Promise<PendingInvitationRow[]> {
  const { data, error } = await supabaseAdmin
    .from("organization_invitations")
    .select("id, email, role, expires_at, created_at")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[org-invites] list:", error.message)
    return []
  }

  return (data ?? []) as PendingInvitationRow[]
}

export async function createOrRefreshInvitation(params: {
  actorUserId: string
  organizationId: string
  emailRaw: string
  role: "admin" | "member"
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(params.emailRaw)
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." }
  }

  const membership = await getMembershipRole(params.actorUserId, params.organizationId)
  if (!membership || (membership !== "owner" && membership !== "admin")) {
    return { ok: false, error: "Only owners and admins can send invites." }
  }

  const org = await getOrganizationByIdForUser(params.actorUserId, params.organizationId)
  if (!org) {
    return { ok: false, error: "Organization not found." }
  }
  if (org.isPersonal) {
    return { ok: false, error: "Invite teammates to a team workspace, not your personal one." }
  }

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  const { data: existing } = await supabaseAdmin
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("email", email)
    .is("accepted_at", null)
    .maybeSingle()

  if (existing?.id) {
    const { error: upErr } = await supabaseAdmin
      .from("organization_invitations")
      .update({
        token,
        role: params.role,
        invited_by_user_id: params.actorUserId,
        expires_at: expiresAt,
      })
      .eq("id", existing.id)

    if (upErr) return { ok: false, error: upErr.message }
  } else {
    const { error: insErr } = await supabaseAdmin.from("organization_invitations").insert({
      organization_id: params.organizationId,
      email,
      token,
      role: params.role,
      invited_by_user_id: params.actorUserId,
      expires_at: expiresAt,
    })

    if (insErr) {
      if (/unique|duplicate/i.test(insErr.message)) {
        return { ok: false, error: "That email already has a pending invite." }
      }
      return { ok: false, error: insErr.message }
    }
  }

  const inviterName = await getInviterDisplayName(params.actorUserId)
  const acceptUrl = buildOrganizationInviteAcceptUrl(token)
  const sent = await sendOrganizationInviteEmail({
    to: email,
    inviterName,
    organizationName: org.displayName,
    acceptUrl,
  })

  if (!sent.ok) {
    return {
      ok: false,
      error:
        sent.error ??
        "Invite was saved but email could not be sent. Check RESEND_API_KEY and RESEND_FROM_EMAIL.",
    }
  }

  return { ok: true }
}

export async function revokeInvitation(params: {
  actorUserId: string
  invitationId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: row, error: fetchErr } = await supabaseAdmin
    .from("organization_invitations")
    .select("organization_id, accepted_at")
    .eq("id", params.invitationId)
    .maybeSingle()

  if (fetchErr || !row) {
    return { ok: false, error: "Invitation not found." }
  }
  if (row.accepted_at) {
    return { ok: false, error: "That invite was already accepted." }
  }

  const membership = await getMembershipRole(params.actorUserId, row.organization_id as string)
  if (!membership || (membership !== "owner" && membership !== "admin")) {
    return { ok: false, error: "You cannot revoke this invite." }
  }

  const { error: delErr } = await supabaseAdmin
    .from("organization_invitations")
    .delete()
    .eq("id", params.invitationId)

  if (delErr) return { ok: false, error: delErr.message }
  return { ok: true }
}

export async function acceptInvitationByToken(params: {
  userId: string
  userEmail: string
  token: string
}): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const token = params.token.trim()
  if (!token) {
    return { ok: false, error: "Missing invite link." }
  }

  const email = normalizeEmail(params.userEmail)

  const { data: invite, error: invErr } = await supabaseAdmin
    .from("organization_invitations")
    .select("id, organization_id, email, expires_at, accepted_at, role")
    .eq("token", token)
    .maybeSingle()

  if (invErr || !invite) {
    return { ok: false, error: "This invite link is invalid or expired." }
  }

  if (invite.accepted_at) {
    return { ok: false, error: "This invite was already used." }
  }

  if (new Date(invite.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "This invite expired. Ask for a new one." }
  }

  if (normalizeEmail(invite.email as string) !== email) {
    return {
      ok: false,
      error: `Sign in with ${invite.email as string}. This invite is for that address only.`,
    }
  }

  const orgId = invite.organization_id as string

  const { data: already } = await supabaseAdmin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", params.userId)
    .maybeSingle()

  if (already) {
    await supabaseAdmin.from("organization_invitations").delete().eq("id", invite.id)
    return { ok: true, organizationId: orgId }
  }

  const inviteRole = invite.role === "admin" ? "admin" : "member"

  const { error: memErr } = await supabaseAdmin.from("organization_members").insert({
    organization_id: orgId,
    user_id: params.userId,
    role: inviteRole,
  })

  if (memErr) {
    return { ok: false, error: memErr.message }
  }

  await supabaseAdmin.from("organization_invitations").delete().eq("id", invite.id)

  return { ok: true, organizationId: orgId }
}
