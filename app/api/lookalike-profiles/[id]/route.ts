import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"
import { normalizeDimensions, normalizeOutreachPlaybook, normalizeStats } from "@/lib/lookalike/normalize"
import { generatePlatformQueries, platformQueriesToLegacySearch } from "@/lib/lookalike/generate-queries"

export const maxDuration = 60

async function resolveUserId(req: NextRequest): Promise<{ userId: string } | { error: NextResponse }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  return { userId: user.id }
}

/**
 * GET /api/lookalike-profiles/[id] — full profile + regenerated Layer-2 queries.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserId(_req)
  if ("error" in auth) return auth.error

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const { data: row, error } = await supabaseAdmin
    .from("lookalike_profiles")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const dimensions = normalizeDimensions(row.dimensions)
  const platformQueries = generatePlatformQueries(dimensions)
  const searchQueries = platformQueriesToLegacySearch(dimensions, platformQueries)

  return NextResponse.json({
    id: row.id,
    name: row.name,
    segmentTag: row.segment_tag,
    dimensions,
    outreachPlaybook: normalizeOutreachPlaybook(row.outreach_playbook),
    stats: normalizeStats(row.stats),
    searchQueries,
    platformQueries,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

/**
 * PATCH /api/lookalike-profiles/[id] — e.g. { "isActive": false }
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.isActive === "boolean") {
    patch.is_active = body.isActive
  }

  const { data, error } = await supabaseAdmin
    .from("lookalike_profiles")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id, is_active")
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: "Update failed" }, { status: 400 })
  }

  return NextResponse.json({ ok: true, id: data.id, isActive: data.is_active })
}
