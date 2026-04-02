import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import {
  buildXWatchSuggestions as buildWatchSuggestions,
  normalizeXWatchTerm as normalizeWatchTerm,
  normalizeXWatchTerms as normalizeWatchTerms,
  X_WATCH_TERM_LIMIT as WATCH_TERM_LIMIT,
} from "@/lib/juno/x-watchlist"

async function getProfileKeywordsAndCompetitors(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("company_profile")
    .select("keywords, competitors")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) throw error

  const keywords = Array.isArray(data?.keywords)
    ? data.keywords.filter((value): value is string => typeof value === "string")
    : []
  const competitors = Array.isArray(data?.competitors)
    ? data.competitors.filter((value): value is string => typeof value === "string")
    : []

  return {
    profileExists: Boolean(data),
    keywords: normalizeWatchTerms(keywords),
    competitors: normalizeWatchTerms(competitors),
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { keywords, competitors } = await getProfileKeywordsAndCompetitors(user.id)

    return NextResponse.json({
      watchTerms: keywords,
      suggestions: buildWatchSuggestions(keywords, competitors),
      limit: WATCH_TERM_LIMIT,
    })
  } catch (error) {
    return jsonApiError(500, error, "luckmaxxing watchlist GET")
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { term?: string }
    const term = normalizeWatchTerm(body.term ?? "")
    if (!term) {
      return NextResponse.json({ error: "Add a company, keyword, or phrase to prioritize in Reddit scans." }, { status: 400 })
    }

    const { profileExists, keywords, competitors } = await getProfileKeywordsAndCompetitors(user.id)
    if (!profileExists) {
      return NextResponse.json(
        { error: "Add your company context first so Luckmaxxing has somewhere to save watch terms." },
        { status: 422 },
      )
    }
    const nextKeywords = normalizeWatchTerms([...keywords, term]).slice(0, WATCH_TERM_LIMIT)

    const { error } = await supabase
      .from("company_profile")
      .update({ keywords: nextKeywords })
      .eq("user_id", user.id)

    if (error) {
      return jsonApiError(500, error, "luckmaxxing watchlist POST")
    }

    return NextResponse.json({
      ok: true,
      watchTerms: nextKeywords,
      suggestions: buildWatchSuggestions(nextKeywords, competitors),
      limit: WATCH_TERM_LIMIT,
    })
  } catch (error) {
    return jsonApiError(500, error, "luckmaxxing watchlist POST")
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await req.json().catch(() => ({}))) as { term?: string }
    const term = normalizeWatchTerm(body.term ?? "")
    if (!term) {
      return NextResponse.json({ error: "Missing watch term." }, { status: 400 })
    }

    const { profileExists, keywords, competitors } = await getProfileKeywordsAndCompetitors(user.id)
    if (!profileExists) {
      return NextResponse.json(
        { error: "Add your company context first so Luckmaxxing has somewhere to save watch terms." },
        { status: 422 },
      )
    }
    const nextKeywords = keywords.filter((value) => value.toLowerCase() !== term.toLowerCase())

    const { error } = await supabase
      .from("company_profile")
      .update({ keywords: nextKeywords })
      .eq("user_id", user.id)

    if (error) {
      return jsonApiError(500, error, "luckmaxxing watchlist DELETE")
    }

    return NextResponse.json({
      ok: true,
      watchTerms: nextKeywords,
      suggestions: buildWatchSuggestions(nextKeywords, competitors),
      limit: WATCH_TERM_LIMIT,
    })
  } catch (error) {
    return jsonApiError(500, error, "luckmaxxing watchlist DELETE")
  }
}
