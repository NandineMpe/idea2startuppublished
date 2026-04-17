/**
 * GET /api/preview/intelligence/<slug>/enter
 *
 * Turns a share slug into a read-only impersonation session:
 *   1. Looks up the share
 *   2. Mints a one-shot magic link via the admin API (never emailed)
 *   3. Verifies it server-side so the SSR client sets normal Supabase auth cookies
 *   4. Sets a `juno_preview_mode` cookie so middleware blocks writes and the
 *      dashboard layout shows a "Read-only preview" banner
 *   5. Redirects to /dashboard so the viewer lands on the real UI
 */

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/supabase"
import { createClient } from "@/lib/supabase/server"
import { getIntelligencePreviewShareBySlug } from "@/lib/intelligence-preview"
import { PREVIEW_LABEL_COOKIE, PREVIEW_MODE_COOKIE } from "@/lib/preview-mode"

export const dynamic = "force-dynamic"

function backToLanding(request: Request, reason: string, slug: string) {
  const url = new URL(`/preview/intelligence/${encodeURIComponent(slug)}`, request.url)
  url.searchParams.set("error", reason)
  return NextResponse.redirect(url)
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const share = await getIntelligencePreviewShareBySlug(slug)
  if (!share) return backToLanding(request, "not_found", slug)

  const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(share.userId)
  if (userErr || !userRes?.user?.email) {
    console.error("[preview/enter] getUserById failed:", userErr?.message)
    return backToLanding(request, "user_missing", slug)
  }
  const email = userRes.user.email

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (linkErr) {
    console.error("[preview/enter] generateLink failed:", linkErr.message)
    return backToLanding(request, "link_failed", slug)
  }
  const tokenHash = linkData?.properties?.hashed_token
  if (!tokenHash) {
    console.error("[preview/enter] missing hashed_token in generateLink response")
    return backToLanding(request, "link_failed", slug)
  }

  const supabase = await createClient()
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  })
  if (verifyErr) {
    console.error("[preview/enter] verifyOtp failed:", verifyErr.message)
    return backToLanding(request, "verify_failed", slug)
  }

  const cookieStore = await cookies()
  const cookieOptions = {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  }
  cookieStore.set(PREVIEW_MODE_COOKIE, share.slug, cookieOptions)
  cookieStore.set(PREVIEW_LABEL_COOKIE, share.label, cookieOptions)

  return NextResponse.redirect(new URL("/dashboard", request.url))
}
