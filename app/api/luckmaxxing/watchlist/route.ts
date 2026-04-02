import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { buildXWatchSuggestions, normalizeXWatchTerm, normalizeXWatchTerms, X_WATCH_TERM_LIMIT } from "@/lib/juno/x-watchlist"

function isXConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN?.trim())
}

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
    keywords: normalizeXWatchTerms(keywords),
    competitors: normalizeXWatchTerms(competitors),
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
      suggestions: buildXWatchSuggestions(keywords, competitors),
      xReady: isXConfigured(),
      limit: X_WATCH_TERM_LIMIT,
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
    const term = normalizeXWatchTerm(body.term ?? "")
    if (!term) {
      return NextResponse.json({ error: "Add a company, keyword, or phrase to watch." }, { status: 400 })
    }

    const { profileExists, keywords, competitors } = await getProfileKeywordsAndCompetitors(user.id)
    if (!profileExists) {
      return NextResponse.json(
        { error: "Add your company context first so Luckmaxxing has somewhere to save watch terms." },
        { status: 422 },
      )
    }
    const nextKeywords = normalizeXWatchTerms([...keywords, term]).slice(0, X_WATCH_TERM_LIMIT)

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
      suggestions: buildXWatchSuggestions(nextKeywords, competitors),
      xReady: isXConfigured(),
      limit: X_WATCH_TERM_LIMIT,
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
    const term = normalizeXWatchTerm(body.term ?? "")
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
      suggestions: buildXWatchSuggestions(nextKeywords, competitors),
      xReady: isXConfigured(),
      limit: X_WATCH_TERM_LIMIT,
    })
  } catch (error) {
    return jsonApiError(500, error, "luckmaxxing watchlist DELETE")
  }
}
