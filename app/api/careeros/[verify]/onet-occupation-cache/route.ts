/**
 * GET /api/careeros/_verify/onet-occupation-cache?token=
 * Module 2.1 diagnostic — count + sample rows in `careeros.onet_occupations_cache`.
 */
import { NextResponse } from "next/server"
import { getOnetDataRelease } from "@/lib/careeros/market/onet-occupation-cache"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limitParam = url.searchParams.get("limit")
  const limit = Math.min(20, Math.max(1, Number(limitParam) || 5))

  const { count, error: countError } = await supabaseAdmin
    .schema("careeros")
    .from("onet_occupations_cache")
    .select("*", { count: "exact", head: true })

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  const { data: sample, error: sampleError } = await supabaseAdmin
    .schema("careeros")
    .from("onet_occupations_cache")
    .select("onet_soc_code,onet_release,title,updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (sampleError) {
    return NextResponse.json({ error: sampleError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    onet_data_release_config: getOnetDataRelease(),
    total_rows: count ?? 0,
    sample,
  })
}
