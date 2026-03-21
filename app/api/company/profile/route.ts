import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ profile: null })
    }

    const { data: profile, error } = await supabase
      .from("company_profile")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") throw error

    return NextResponse.json({ profile: profile ?? null })
  } catch (error) {
    console.error("Company profile GET error:", error)
    return NextResponse.json({ profile: null }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      company_name,
      tagline,
      problem,
      solution,
      target_market,
      industry,
      stage,
      traction,
      team_summary,
      funding_goal,
      founder_name,
      founder_location,
      founder_background,
    } = body

    const { data, error } = await supabase
      .from("company_profile")
      .upsert(
        {
          user_id: user.id,
          company_name: company_name ?? null,
          tagline: tagline ?? null,
          problem: problem ?? null,
          solution: solution ?? null,
          target_market: target_market ?? null,
          industry: industry ?? null,
          stage: stage ?? null,
          traction: traction ?? null,
          team_summary: team_summary ?? null,
          funding_goal: funding_goal ?? null,
          founder_name: founder_name ?? null,
          founder_location: founder_location ?? null,
          founder_background: founder_background ?? null,
        },
        { onConflict: "user_id" },
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error("Company profile PUT error:", error)
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 })
  }
}
