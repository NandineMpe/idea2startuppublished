import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

function isStringArray(val: unknown): val is string[] {
  return Array.isArray(val) && val.every((x) => typeof x === "string")
}

function normalizeStringArray(val: unknown): string[] {
  if (!isStringArray(val)) return []
  return val.map((s) => s.trim()).filter(Boolean)
}

/** PATCH voice/messaging fields only — does not null the rest of company_profile. */
export async function PATCH(request: Request) {
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
      brand_voice_dna,
      brand_promise,
      brand_channel_voice,
      brand_words_use,
      brand_words_never,
      brand_credibility_hooks,
    } = body as Record<string, unknown>

    if (typeof brand_voice_dna !== "string" || typeof brand_promise !== "string") {
      return NextResponse.json(
        { error: "Expected brand_voice_dna and brand_promise as strings" },
        { status: 400 },
      )
    }

    if (!brand_channel_voice || typeof brand_channel_voice !== "object" || Array.isArray(brand_channel_voice)) {
      return NextResponse.json({ error: "Expected brand_channel_voice as object" }, { status: 400 })
    }

    const ch = brand_channel_voice as Record<string, unknown>
    const linkedin = typeof ch.linkedin === "string" ? ch.linkedin : ""
    const cold_email = typeof ch.cold_email === "string" ? ch.cold_email : ""
    const reddit_hn = typeof ch.reddit_hn === "string" ? ch.reddit_hn : ""

    if (!isStringArray(brand_words_use) || !isStringArray(brand_words_never) || !isStringArray(brand_credibility_hooks)) {
      return NextResponse.json(
        { error: "Expected brand_words_use, brand_words_never, brand_credibility_hooks as string arrays" },
        { status: 400 },
      )
    }

    const { data, error } = await supabase
      .from("company_profile")
      .update({
        brand_voice_dna: brand_voice_dna.trim() ? brand_voice_dna : null,
        brand_promise: brand_promise.trim() ? brand_promise : null,
        brand_channel_voice: {
          linkedin: linkedin.trim(),
          cold_email: cold_email.trim(),
          reddit_hn: reddit_hn.trim(),
        },
        brand_words_use: normalizeStringArray(brand_words_use),
        brand_words_never: normalizeStringArray(brand_words_never),
        brand_credibility_hooks: normalizeStringArray(brand_credibility_hooks),
      })
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ profile: data })
  } catch (error) {
    console.error("Company profile branding PATCH error:", error)
    return NextResponse.json({ error: "Failed to save branding" }, { status: 500 })
  }
}
