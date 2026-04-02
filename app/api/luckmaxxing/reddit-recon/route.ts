import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { getCompanyContext } from "@/lib/company-context"
import { summarizeRedditRecon, type RedditReconSignal } from "@/lib/juno/reddit-recon"
import { createClient } from "@/lib/supabase/server"

function buildContextSources(context: NonNullable<Awaited<ReturnType<typeof getCompanyContext>>>): string[] {
  const sources = ["Company profile"]

  if (context.assets.length > 0) sources.push("Saved documents & assets")
  if (context.profile.knowledge_base_md.trim()) sources.push("Knowledge base")
  if (context.profile.vault_context_cache.trim()) sources.push("Obsidian vault cache")

  return sources
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const context = await getCompanyContext(user.id, {
      queryHint: "reddit customer frustrations product gaps opportunity validation",
      refreshVault: "if_stale",
    })

    if (!context) {
      return NextResponse.json(
        { error: "Add your company context first so Reddit signals can be reconciled against it." },
        { status: 422 },
      )
    }

    const { data, error } = await supabase
      .from("intent_signals")
      .select(
        "title, body, subreddit, matched_keywords, why_relevant, url, discovered_at, relevance_score, signal_type",
      )
      .eq("user_id", user.id)
      .eq("platform", "reddit")
      .order("discovered_at", { ascending: false })
      .limit(16)

    if (error) {
      return jsonApiError(500, error, "luckmaxxing reddit-recon GET")
    }

    const signals = (data ?? []) as RedditReconSignal[]
    const summary = await summarizeRedditRecon(context, signals)
    const subreddits = [...new Set(signals.map((signal) => signal.subreddit).filter(Boolean) as string[])]

    return NextResponse.json({
      data: {
        ...summary,
        companyName: context.profile.name,
        conversationCount: signals.length,
        contextSources: buildContextSources(context),
        contextLastSyncedAt:
          context.profile.vault_context_last_synced_at ??
          context.profile.knowledge_base_updated_at ??
          null,
        vaultConnected: Boolean(context.profile.github_vault_repo.trim()),
        subreddits,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    return jsonApiError(500, error, "luckmaxxing reddit-recon GET")
  }
}
