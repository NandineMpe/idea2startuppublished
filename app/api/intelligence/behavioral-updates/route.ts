import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { getCompanyContext } from "@/lib/company-context"
import { REDDIT_SUBREDDITS } from "@/lib/juno/intent-keywords"
import {
  coerceBehavioralSummary,
  summarizeRedditRecon,
  type RedditBehavioralSummary,
  type RedditReconSignal,
} from "@/lib/juno/reddit-recon"
import { createClient } from "@/lib/supabase/server"

type BehavioralUpdatesThread = RedditReconSignal & {
  id: string
  author: string | null
  engagement_score: number | null
  urgency: string | null
  status: string
}

function buildContextSources(context: NonNullable<Awaited<ReturnType<typeof getCompanyContext>>>): string[] {
  const sources = ["Company profile"]

  if (context.assets.length > 0) sources.push("Saved documents and assets")
  if (context.profile.knowledge_base_md.trim()) sources.push("Knowledge base")
  if (context.profile.vault_context_cache.trim()) sources.push("Obsidian vault cache")

  return sources
}

function parseCachedSummary(value: unknown): RedditBehavioralSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return coerceBehavioralSummary((value as Record<string, unknown>).summary)
}

function buildEmptyWorkspaceSummary(companyName: string): RedditBehavioralSummary {
  return {
    overview: `No Reddit evidence is saved yet for ${companyName}. This workspace is isolated, so owner-level scans are intentionally hidden.`,
    sentiment:
      "Add context and run scans from this workspace once workspace intelligence runs are enabled.",
    themes: [],
    pushOfPresent: [],
    pullOfNew: [],
    anxietyOfNew: [],
    allegianceToOld: [],
    currentSolutions: [],
    frictionPoints: [],
    workarounds: [],
    discoveryPaths: [],
    buyingProcess: [],
    painPoints: [],
    gains: [],
    nextMoves: [],
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const subredditParam = searchParams.get("subreddit")
    const forceLiveSummary =
      searchParams.get("refresh") === "1" || searchParams.get("refresh")?.toLowerCase() === "true"
    const selectedSubreddit =
      subredditParam && subredditParam.trim() && subredditParam.trim().toLowerCase() !== "all"
        ? subredditParam.trim()
        : null
    const limitParam = Number(searchParams.get("limit") ?? 10)
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.round(limitParam), 4), 24) : 10

    const context = await getCompanyContext(user.id, {
      queryHint: "reddit customer frustrations buying process workarounds discovery and product gaps",
      refreshVault: "if_stale",
      
    })

    if (!context) {
      return NextResponse.json(
        { error: "Add your company context first so Reddit signals can be synthesized against it." },
        { status: 422 },
      )
    }

    if (context.scope === "workspace") {
      const workspaceName =
        context.workspaceDisplayName?.trim() || context.profile.name.trim() || "this workspace"

      return NextResponse.json({
        data: {
          ...buildEmptyWorkspaceSummary(workspaceName),
          companyName: workspaceName,
          synthesisCombined: !selectedSubreddit,
          subredditsInSynthesisBatch: [],
          conversationCount: 0,
          latestThreadAt: null,
          contextSources: buildContextSources(context),
          contextLastSyncedAt:
            context.profile.vault_context_last_synced_at ??
            context.profile.knowledge_base_updated_at ??
            null,
          vaultConnected: Boolean(context.profile.github_vault_repo.trim()),
          selectedSubreddit,
          subreddits: context.profile.reddit_intent_subreddits ?? [],
          redditIntentSaved: context.profile.reddit_intent_subreddits,
          redditScanDefaults: [],
          threads: [],
          summarySource: "live",
          generatedAt: new Date().toISOString(),
          lastScanOutcome: null,
          lastBehavioralArtifactAt: null,
          workspaceScope: true,
          workspaceName,
        },
      })
    }

    let threadsQuery = supabase
      .from("intent_signals")
      .select(
        "id, title, body, subreddit, matched_keywords, why_relevant, url, discovered_at, relevance_score, signal_type, author, engagement_score, urgency, status",
      )
      .eq("user_id", user.id)
      .eq("platform", "reddit")
      .order("discovered_at", { ascending: false })
      .limit(limit)

    let summarySignalsQuery = supabase
      .from("intent_signals")
      .select(
        "id, title, body, subreddit, matched_keywords, why_relevant, url, discovered_at, relevance_score, signal_type, author, engagement_score, urgency, status",
      )
      .eq("user_id", user.id)
      .eq("platform", "reddit")
      .order("discovered_at", { ascending: false })
      .limit(24)

    if (selectedSubreddit) {
      threadsQuery = threadsQuery.eq("subreddit", selectedSubreddit)
      summarySignalsQuery = summarySignalsQuery.eq("subreddit", selectedSubreddit)
    }

    const [
      { data: threadsData, error: threadsError },
      { data: summarySignalsData, error: summarySignalsError },
      { data: subredditRows, error: subredditError },
      { data: latestBehavioralRows, error: latestBehavioralError },
    ] = await Promise.all([
      threadsQuery,
      summarySignalsQuery,
      supabase
        .from("intent_signals")
        .select("subreddit, discovered_at")
        .eq("user_id", user.id)
        .eq("platform", "reddit")
        .order("discovered_at", { ascending: false })
        .limit(80),
      supabase
        .from("ai_outputs")
        .select("inputs, created_at, metadata")
        .eq("user_id", user.id)
        .eq("tool", "behavioral_updates")
        .order("created_at", { ascending: false })
        .limit(1),
    ])

    if (threadsError) return jsonApiError(500, threadsError, "behavioral-updates GET threads")
    if (summarySignalsError) {
      return jsonApiError(500, summarySignalsError, "behavioral-updates GET summary-signals")
    }
    if (subredditError) return jsonApiError(500, subredditError, "behavioral-updates GET subreddits")
    if (latestBehavioralError) return jsonApiError(500, latestBehavioralError, "behavioral-updates GET latest artifact")

    const threads = (threadsData ?? []) as BehavioralUpdatesThread[]
    const summarySignals = (summarySignalsData ?? []) as BehavioralUpdatesThread[]
    const fromSignals = (subredditRows ?? [])
      .map((row) => (typeof row.subreddit === "string" ? row.subreddit.trim().toLowerCase() : ""))
      .filter(Boolean)
    const saved = context.profile.reddit_intent_subreddits ?? []
    const defaults = REDDIT_SUBREDDITS.map((s) => s.toLowerCase())
    const subreddits = [...new Set([...saved, ...fromSignals, ...defaults])].sort((a, b) =>
      a.localeCompare(b),
    )

    const latestBehavioral = latestBehavioralRows?.[0] ?? null
    const cachedSummary =
      latestBehavioral && !selectedSubreddit && !forceLiveSummary
        ? parseCachedSummary(latestBehavioral.inputs)
        : null
    const cachedMeta = latestBehavioral?.metadata
    const lastScanOutcome =
      cachedMeta && typeof cachedMeta === "object" && "scan_outcome" in cachedMeta
        ? String((cachedMeta as Record<string, unknown>).scan_outcome ?? "").trim() || null
        : null
    const lastBehavioralArtifactAt =
      typeof latestBehavioral?.created_at === "string" ? latestBehavioral.created_at : null
    const summary =
      cachedSummary && !selectedSubreddit
        ? cachedSummary
        : await summarizeRedditRecon(context, summarySignals)

    const subredditsInSynthesisBatch = [
      ...new Set(
        summarySignals
          .map((s) => (typeof s.subreddit === "string" ? s.subreddit.trim().toLowerCase() : ""))
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b))

    return NextResponse.json({
      data: {
        ...summary,
        companyName: context.profile.name,
        synthesisCombined: !selectedSubreddit,
        subredditsInSynthesisBatch,
        conversationCount: summarySignals.length,
        latestThreadAt: summarySignals[0]?.discovered_at ?? null,
        contextSources: buildContextSources(context),
        contextLastSyncedAt:
          context.profile.vault_context_last_synced_at ??
          context.profile.knowledge_base_updated_at ??
          null,
        vaultConnected: Boolean(context.profile.github_vault_repo.trim()),
        selectedSubreddit,
        subreddits,
        redditIntentSaved: context.profile.reddit_intent_subreddits,
        redditScanDefaults: defaults,
        threads,
        summarySource:
          cachedSummary && !selectedSubreddit && !forceLiveSummary ? "cached" : "live",
        generatedAt: new Date().toISOString(),
        lastScanOutcome,
        lastBehavioralArtifactAt,
      },
    })
  } catch (error) {
    return jsonApiError(500, error, "behavioral-updates GET")
  }
}
