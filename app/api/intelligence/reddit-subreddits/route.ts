import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { getCompanyContext } from "@/lib/company-context"
import {
  defaultSubredditsFromContext,
  suggestSubredditsFromContext,
} from "@/lib/juno/reddit-subreddit-suggest"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const context = await getCompanyContext(user.id, {
      queryHint: "reddit customer pain points product gaps ICP buying signals",
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
      defaults: defaultSubredditsFromContext(context),
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
      queryHint: "reddit customer pain points product gaps ICP buying signals",
      refreshVault: "if_stale",
    })

    if (!context) {
      return NextResponse.json(
        { error: "Add your company context first." },
        { status: 422 },
      )
    }

    const suggestions = await suggestSubredditsFromContext(context)
    const defaults = defaultSubredditsFromContext(context)
    return NextResponse.json({ suggestions, defaults })
  } catch (error) {
    return jsonApiError(500, error, "reddit-subreddits POST")
  }
}
