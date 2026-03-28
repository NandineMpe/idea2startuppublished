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
      company_description,
      problem,
      solution,
      target_market,
      industry,
      vertical,
      stage,
      traction,
      team_summary,
      funding_goal,
      founder_name,
      founder_location,
      founder_background,
      thesis,
      business_model,
      differentiators,
      icp,
      competitors,
      keywords,
      priorities,
      risks,
      jack_jill_jobs,
      brand_voice,
      brand_promise,
      brand_never_say,
      brand_proof_points,
      brand_voice_dna,
      brand_channel_voice,
      brand_words_use,
      brand_words_never,
      brand_credibility_hooks,
      github_repo,
      github_branch,
    } = body

    const { data: existingRow } = await supabase
      .from("company_profile")
      .select(
        "jack_jill_jobs, brand_voice, brand_promise, brand_never_say, brand_proof_points, brand_voice_dna, brand_channel_voice, brand_words_use, brand_words_never, brand_credibility_hooks",
      )
      .eq("user_id", user.id)
      .maybeSingle()

    const resolvedJackJill =
      jack_jill_jobs !== undefined && jack_jill_jobs !== null
        ? jack_jill_jobs
        : (existingRow?.jack_jill_jobs as unknown[] | null | undefined) ?? []

    const resolvedBrandVoice =
      brand_voice !== undefined ? brand_voice : (existingRow?.brand_voice as string | null) ?? null
    const resolvedBrandPromise =
      brand_promise !== undefined ? brand_promise : (existingRow?.brand_promise as string | null) ?? null
    const resolvedBrandNeverSay =
      brand_never_say !== undefined ? brand_never_say : (existingRow?.brand_never_say as string | null) ?? null
    const resolvedBrandProofPoints =
      brand_proof_points !== undefined
        ? brand_proof_points
        : (existingRow?.brand_proof_points as string | null) ?? null

    const resolvedBrandVoiceDna =
      brand_voice_dna !== undefined ? brand_voice_dna : (existingRow?.brand_voice_dna as string | null) ?? null
    const resolvedBrandChannelVoice =
      brand_channel_voice !== undefined
        ? brand_channel_voice
        : (existingRow?.brand_channel_voice as Record<string, unknown> | null) ?? null
    const resolvedBrandWordsUse =
      brand_words_use !== undefined ? brand_words_use : (existingRow?.brand_words_use as unknown[] | null) ?? null
    const resolvedBrandWordsNever =
      brand_words_never !== undefined
        ? brand_words_never
        : (existingRow?.brand_words_never as unknown[] | null) ?? null
    const resolvedBrandCredibilityHooks =
      brand_credibility_hooks !== undefined
        ? brand_credibility_hooks
        : (existingRow?.brand_credibility_hooks as unknown[] | null) ?? null

    const { data, error } = await supabase
      .from("company_profile")
      .upsert(
        {
          user_id: user.id,
          company_name: company_name ?? null,
          tagline: tagline ?? null,
          company_description: company_description ?? null,
          problem: problem ?? null,
          solution: solution ?? null,
          target_market: target_market ?? null,
          industry: industry ?? null,
          vertical: vertical ?? null,
          stage: stage ?? null,
          traction: traction ?? null,
          team_summary: team_summary ?? null,
          funding_goal: funding_goal ?? null,
          founder_name: founder_name ?? null,
          founder_location: founder_location ?? null,
          founder_background: founder_background ?? null,
          thesis: thesis ?? null,
          business_model: business_model ?? null,
          differentiators: differentiators ?? null,
          icp: icp ?? null,
          competitors: competitors ?? null,
          keywords: keywords ?? null,
          priorities: priorities ?? null,
          risks: risks ?? null,
          jack_jill_jobs: resolvedJackJill,
          brand_voice: resolvedBrandVoice,
          brand_promise: resolvedBrandPromise,
          brand_never_say: resolvedBrandNeverSay,
          brand_proof_points: resolvedBrandProofPoints,
          brand_voice_dna: resolvedBrandVoiceDna,
          brand_channel_voice: resolvedBrandChannelVoice,
          brand_words_use: resolvedBrandWordsUse,
          brand_words_never: resolvedBrandWordsNever,
          brand_credibility_hooks: resolvedBrandCredibilityHooks,
          ...(github_repo !== undefined ? { github_repo } : {}),
          ...(github_branch !== undefined ? { github_branch } : {}),
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
