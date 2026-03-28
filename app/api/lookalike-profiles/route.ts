import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { supabaseAdmin } from "@/lib/supabase"

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
 * GET /api/lookalike-profiles — list active profiles (newest first).
 */
export async function GET(req: NextRequest) {
  const auth = await resolveUserId(req)
  if ("error" in auth) return auth.error

  const { data, error } = await supabaseAdmin
    .from("lookalike_profiles")
    .select("id, name, segment_tag, stats, is_active, created_at, updated_at")
    .eq("user_id", auth.userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profiles: data ?? [] })
}
