import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .schema("careeros")
    .from("user_career_health_reports")
    .select(
      "id,report_year,report_quarter,version,is_current,score_overall,report_payload,created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!row) {
    return NextResponse.json({ report: null })
  }

  return NextResponse.json({ report: row })
}
