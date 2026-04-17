/**
 * Admin-only CRUD for intelligence preview share links.
 *
 * POST /api/admin/intelligence-preview  { slug, userId?, workspaceSlug?, organizationSlug?, label, flags?, expiresAt? }
 * GET  /api/admin/intelligence-preview
 * DELETE /api/admin/intelligence-preview?id=<share-id>   (soft-deletes via is_active=false)
 *
 * By default the share is pinned to the calling admin's own user_id, which
 * matches the most common case (the admin wants to share their own
 * intelligence feed for a specific company they operate).
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { resolveAppUrl } from "@/lib/app-url"
import {
  createIntelligencePreviewShare,
  deactivateIntelligencePreviewShare,
  listIntelligencePreviewShares,
} from "@/lib/intelligence-preview"

export const dynamic = "force-dynamic"

async function requireAdmin(): Promise<
  { userId: string; email: string } | { error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail && user.email?.toLowerCase() !== adminEmail) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { userId: user.id, email: user.email ?? "" }
}

async function resolveOrganizationIdBySlug(slug: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

async function resolveWorkspaceIdBySlug(
  slug: string,
  ownerUserId: string,
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("client_workspaces")
    .select("id")
    .eq("slug", slug.trim().toLowerCase())
    .eq("owner_user_id", ownerUserId)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const slug = typeof body.slug === "string" ? body.slug : ""
  const label = typeof body.label === "string" ? body.label : ""
  const explicitUserId = typeof body.userId === "string" ? body.userId.trim() : ""
  const workspaceSlug = typeof body.workspaceSlug === "string" ? body.workspaceSlug.trim() : ""
  const organizationSlug =
    typeof body.organizationSlug === "string" ? body.organizationSlug.trim() : ""
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : null

  if (!slug.trim()) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 })
  }
  if (!label.trim()) {
    return NextResponse.json(
      { error: "label is required (shown on the preview header)" },
      { status: 400 },
    )
  }

  const targetUserId = explicitUserId || auth.userId

  let workspaceId: string | null = null
  if (workspaceSlug) {
    workspaceId = await resolveWorkspaceIdBySlug(workspaceSlug, targetUserId)
    if (!workspaceId) {
      return NextResponse.json(
        { error: `No workspace with slug "${workspaceSlug}" for that user.` },
        { status: 404 },
      )
    }
  }

  let organizationId: string | null = null
  if (organizationSlug) {
    organizationId = await resolveOrganizationIdBySlug(organizationSlug)
    if (!organizationId) {
      return NextResponse.json(
        { error: `No organization with slug "${organizationSlug}".` },
        { status: 404 },
      )
    }
  }

  const flags = (body.flags as Record<string, unknown> | undefined) ?? {}

  const result = await createIntelligencePreviewShare({
    slug,
    label,
    userId: targetUserId,
    organizationId,
    workspaceId,
    createdBy: auth.userId,
    expiresAt,
    showSignalFeed: flags.showSignalFeed !== false,
    showSecurityAlerts: flags.showSecurityAlerts !== false,
    showBehavioral: flags.showBehavioral !== false,
    showIntentSignals: flags.showIntentSignals !== false,
  })

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const url = `${resolveAppUrl()}/preview/intelligence/${encodeURIComponent(result.share.slug)}`
  return NextResponse.json({ ok: true, share: result.share, url })
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const shares = await listIntelligencePreviewShares(auth.userId)
  const appUrl = resolveAppUrl()
  return NextResponse.json({
    shares: shares.map((share) => ({
      ...share,
      url: `${appUrl}/preview/intelligence/${encodeURIComponent(share.slug)}`,
    })),
  })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  const url = new URL(request.url)
  const id = url.searchParams.get("id")?.trim() ?? ""
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const result = await deactivateIntelligencePreviewShare(id, auth.userId)
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
