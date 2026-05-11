import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: Request, context: { params: Promise<{ verify: string }> }) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = url.searchParams.get("user_id")
  if (!userId) {
    return NextResponse.json({ error: "user_id query param required" }, { status: 400 })
  }

  const { data: extraction } = await supabaseAdmin
    .schema("careeros")
    .from("user_document_extractions")
    .select("id, parser_name, parser_version, extraction_version, input_data_version, created_at")
    .eq("user_id", userId)
    .eq("parser_name", "careeros-profile-extract")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: skillsCount } = await supabaseAdmin
    .schema("careeros")
    .from("user_skills")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true)

  const { data: latestRun } = await supabaseAdmin
    .schema("careeros")
    .from("generation_runs")
    .select("id, status, model_name, model_version, latency_ms, token_usage, created_at")
    .eq("user_id", userId)
    .eq("workflow_name", "careeros/profile.extract")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    user_id: userId,
    extraction_status: extraction ? "completed" : latestRun?.status ?? "none",
    extraction,
    skills_count: skillsCount ?? 0,
    latest_generation_run: latestRun,
  })
}
