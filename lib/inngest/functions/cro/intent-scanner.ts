/**
 * Reddit behavioral pipeline (Inngest durable workflow, defined in code — synced via /api/inngest).
 * Fan-out cron → per-user: resolve subreddits (profile pins or LLM + defaults) → scan Reddit → score →
 * persist intent_signals → synthesize behavioral summary → ai_outputs (behavioral_updates).
 * Local debugging: `npm run inngest:dev` + `npm run dev` (CLI dev server does not replace this source).
 */
import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { buildKeywordList } from "@/lib/juno/intent-keywords"
import { resolveSubredditsForIntentScan } from "@/lib/juno/reddit-subreddit-suggest"
import { crawlRedditForIntent, scanRedditForIntent } from "@/lib/juno/intent-monitor"
import { buildIntentScoreCalibrationBlock } from "@/lib/juno/intent-score-calibration"
import { scoreIntentSignals, type ScoredIntent } from "@/lib/juno/intent-scoring"
import { summarizeRedditRecon, type RedditReconSignal } from "@/lib/juno/reddit-recon"
import { getFanOutUserIds } from "@/lib/juno/users"
import { supabaseAdmin } from "@/lib/supabase"

function toRedditReconSignals(signals: ScoredIntent[]): RedditReconSignal[] {
  return signals.map((signal) => ({
    title: signal.title,
    body: signal.body || null,
    subreddit: signal.subreddit ?? null,
    matched_keywords: signal.matchedKeywords ?? [],
    why_relevant: signal.whyRelevant,
    url: signal.url,
    discovered_at: signal.discoveredAt,
    relevance_score: signal.relevanceScore,
    signal_type: signal.type,
  }))
}

async function saveBehavioralUpdatesArtifact(params: {
  userId: string
  organizationId: string | null
  companyName: string
  signals: RedditReconSignal[]
  summary: Awaited<ReturnType<typeof summarizeRedditRecon>>
  scanOutcome?: "no_candidates" | "ok"
}) {
  const { userId, organizationId, companyName, signals, summary, scanOutcome } = params
  const dateStr = new Date().toISOString().slice(0, 10)
  const uniqueSubreddits = [...new Set(signals.map((signal) => signal.subreddit).filter(Boolean) as string[])]
  const latestSignalAt =
    signals
      .map((signal) => signal.discovered_at)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

  const { error } = await supabaseAdmin.from("ai_outputs").insert({
    user_id: userId,
    ...(organizationId ? { organization_id: organizationId } : {}),
    tool: "behavioral_updates",
    title: `Behavioral updates - ${companyName || "Customer research"} - ${dateStr}`.slice(0, 500),
    output: summary.overview,
    inputs: {
      summary,
      companyName,
      conversationCount: signals.length,
      subreddits: uniqueSubreddits,
      latestSignalAt,
      source: "reddit",
    },
    metadata: {
      generated_at: new Date().toISOString(),
      source: "reddit",
      signal_count: signals.length,
      latest_signal_at: latestSignalAt,
      subreddits: uniqueSubreddits,
      ...(scanOutcome ? { scan_outcome: scanOutcome } : {}),
    },
  })

  if (error) {
    console.error("[intent-scanner] behavioral_updates insert:", error.message)
  }
}

export const intentScanFanOut = inngest.createFunction(
  {
    id: "cro-intent-scan-fanout",
    name: "CRO: Reddit behavioral scan fan-out (4h)",
    triggers: [{ cron: "15 */4 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getFanOutUserIds)
    if (userIds.length > 0) {
      await step.sendEvent(
        "fan-out-intent-scan",
        userIds.map((userId) => ({
          name: "juno/intent.scan.requested" as const,
          data: { userId },
        })),
      )
    }
    return { users: userIds.length }
  },
)

export const intentScanner = inngest.createFunction(
  {
    id: "cro-intent-scanner",
    name: "CRO: Reddit behavioral scan (subreddits → signals → synthesis)",
    retries: 2,
    concurrency: { limit: 2 },
    triggers: [{ event: "juno/intent.scan.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, {
        queryHint:
          "reddit customer pain product gaps audit compliance finance accounting software ICP B2B sales outreach cold email demo CFO buying",
        refreshVault: "if_stale",
      }),
    )

    if (!context) {
      return { userId, saved: 0, reason: "no_company_profile" }
    }

    const keywords = buildKeywordList(context.extracted.keywords)

    const subreddits = await step.run("resolve-subreddits", () =>
      resolveSubredditsForIntentScan(context),
    )

    const redditSignals = await step.run("scan-reddit", async () => {
      const crawled = await crawlRedditForIntent(subreddits, keywords)
      if (crawled.length > 0) return crawled
      // Crawl uses /new.json; server IPs are often blocked or return empty. Search is a second path.
      return scanRedditForIntent(keywords, subreddits)
    })

    // Pre-rank by Reddit upvote score so highest-engagement posts go to LLM first
    const raw = [...redditSignals].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

    if (raw.length === 0) {
      const summary = await step.run("summarize-behavioral-updates-empty", () =>
        summarizeRedditRecon(context, []),
      )
      await step.run("persist-behavioral-updates-empty", () =>
        saveBehavioralUpdatesArtifact({
          userId,
          organizationId: context.organizationId ?? null,
          companyName: context.profile.name.trim(),
          signals: [],
          summary,
          scanOutcome: "no_candidates",
        }),
      )
      return {
        userId,
        scanned: 0,
        saved: 0,
        reason: "no_candidates" as const,
        diagnostics: {
          keywordCount: keywords.length,
          subredditCount: subreddits.length,
          subredditsPreview: subreddits.slice(0, 8),
          hint:
            "Crawl (/new) and search both returned zero posts. Often Reddit blocks server IPs (403/429), or there are no posts in the lookback in those subs. Check names, INTENT_LOOKBACK_DAYS, Inngest logs for [intent-monitor].",
        },
      }
    }

    const calibrationBlock = await step.run("load-score-calibration", () =>
      buildIntentScoreCalibrationBlock(userId),
    )

    const scored = await step.run("score-intents", () =>
      scoreIntentSignals(raw.slice(0, 40), context, { calibrationBlock }),
    )

    const toSave = scored.filter((s) => s.relevanceScore >= 4)
    const hot = scored.filter((s) => s.relevanceScore >= 8)
    const researchSignals = toRedditReconSignals(
      [...toSave].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 16),
    )

    let saved = 0
    await step.run("persist-signals", async () => {
      for (const s of toSave) {
        const { error } = await supabaseAdmin.from("intent_signals").insert({
          user_id: userId,
          ...(context.organizationId ? { organization_id: context.organizationId } : {}),
          platform: s.platform,
          signal_type: s.type,
          title: s.title,
          body: s.body || null,
          url: s.url,
          author: s.author || null,
          subreddit: s.subreddit,
          engagement_score: s.score ?? null,
          relevance_score: s.relevanceScore,
          why_relevant: s.whyRelevant,
          suggested_response: s.suggestedResponse || null,
          response_platform: s.responsePlatform,
          urgency: s.urgency,
          matched_keywords: s.matchedKeywords,
          status: "new",
        })

        if (error) {
          if (/duplicate|unique|23505/i.test(error.message)) continue
          console.error("[intent-scanner] insert:", error.message)
          continue
        }
        saved++
      }
    })

    const summary = await step.run("summarize-behavioral-updates", () =>
      summarizeRedditRecon(context, researchSignals),
    )

    await step.run("persist-behavioral-updates", () =>
      saveBehavioralUpdatesArtifact({
        userId,
        organizationId: context.organizationId ?? null,
        companyName: context.profile.name.trim(),
        signals: researchSignals,
        summary,
      }),
    )

    return {
      userId,
      scanned: raw.length,
      scored: scored.length,
      saved,
      hot: hot.length,
      behavioralSignals: researchSignals.length,
      ...(saved === 0 && scored.length > 0 ? { reason: "all_below_threshold" as const } : {}),
    }
  },
)
