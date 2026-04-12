/**
 * GET  /api/claim?token=...   — preview (email, company, expired?)
 * POST /api/claim             — activate: set password, confirm user, mark claimed
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// ─── GET: preview ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 })
  }

  const { data: invite, error } = await supabaseAdmin
    .from("seeded_invites")
    .select("id, target_email, target_name, target_company, seeded_at, claimed_at, email_preview")
    .eq("token", token)
    .maybeSingle()

  if (error || !invite) {
    return NextResponse.json({ error: "This link is not valid." }, { status: 404 })
  }

  if (invite.claimed_at) {
    return NextResponse.json({ error: "This account has already been claimed.", claimed: true }, { status: 410 })
  }

  // Tokens expire after 30 days
  const seededAt = new Date(invite.seeded_at as string)
  const expired = Date.now() - seededAt.getTime() > 30 * 24 * 60 * 60 * 1000
  if (expired) {
    return NextResponse.json({ error: "This invite has expired.", expired: true }, { status: 410 })
  }

  return NextResponse.json({
    email: invite.target_email,
    name: invite.target_name,
    company: invite.target_company,
    emailPreview: invite.email_preview,
  })
}

// ─── POST: claim ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: { token?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const token    = typeof body.token    === "string" ? body.token.trim()    : ""
  const password = typeof body.password === "string" ? body.password.trim() : ""

  if (!token || !password) {
    return NextResponse.json({ error: "token and password are required" }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  // Fetch invite
  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from("seeded_invites")
    .select("id, user_id, target_email, claimed_at, seeded_at")
    .eq("token", token)
    .maybeSingle()

  if (inviteErr || !invite) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 })
  }
  if (invite.claimed_at) {
    return NextResponse.json({ error: "Already claimed", claimed: true }, { status: 410 })
  }

  const seededAt = new Date(invite.seeded_at as string)
  if (Date.now() - seededAt.getTime() > 30 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Invite expired", expired: true }, { status: 410 })
  }

  const userId = invite.user_id as string

  // Set password + confirm the user via admin API
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  })

  if (updateErr) {
    console.error("[claim] updateUserById failed:", updateErr.message)
    return NextResponse.json({ error: "Failed to activate account. Please try again." }, { status: 500 })
  }

  // Mark claimed
  await supabaseAdmin
    .from("seeded_invites")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", invite.id)

  // Sign in the user so they land in the dashboard already authenticated
  const { data: session, error: signInErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: invite.target_email as string,
  })

  if (signInErr || !session?.properties?.action_link) {
    // Fallback: tell client to redirect to /login — they have a password now
    return NextResponse.json({ ok: true, redirect: "/login?claimed=1" })
  }

  return NextResponse.json({ ok: true, redirect: "/dashboard" , magicLink: session.properties.action_link })
}
