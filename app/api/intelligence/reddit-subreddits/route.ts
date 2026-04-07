import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { getCompanyContext } from "@/lib/company-context"
import { REDDIT_SUBREDDITS } from "@/lib/juno/intent-keywords"
import { suggestSubredditsFromContext } from "@/lib/juno/reddit-subreddit-suggest"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const context = await getCompanyContext(user.id, {
      queryHint: "reddit customer pain product gaps audit compliance finance accounting software ICP",
      refreshVault: "if_stale",
    })

    if (!context) {
      return NextResponse.json(
        { error: "Add your company context first." },
        { status: 422 },
      )
    }

    return NextResponse.json({
      saved: context.profile.reddit_intent_subreddits,
      defaults: REDDIT_SUBREDDITS.map((s) => s.toLowerCase()),
    })
  } catch (error) {
    return jsonApiError(500, error, "reddit-subreddits GET")
  }
}

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const context = await getCompanyContext(user.id, {
      queryHint: "reddit customer pain product gaps audit compliance finance accounting software ICP",
      refreshVault: "if_stale",
    })

    if (!context) {
      return NextResponse.json(
        { error: "Add your company context first." },
        { status: 422 },
      )
    }

    const suggestions = await suggestSubredditsFromContext(context)
    return NextResponse.json({ suggestions })
  } catch (error) {
    return jsonApiError(500, error, "reddit-subreddits POST")
  }
}
