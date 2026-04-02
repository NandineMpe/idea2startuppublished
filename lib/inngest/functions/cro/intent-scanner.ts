import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { buildKeywordList, REDDIT_SUBREDDITS } from "@/lib/juno/intent-keywords"
import { scanHNForIntent, scanRedditForIntent } from "@/lib/juno/intent-monitor"
import { scoreIntentSignals } from "@/lib/juno/intent-scoring"
import { hasXRecentSearchConfig, scanXForIntent } from "@/lib/juno/x-monitor"
import { buildXWatchTermsFromContext } from "@/lib/juno/x-watchlist"
import { getFanOutUserIds } from "@/lib/juno/users"
import { supabaseAdmin } from "@/lib/supabase"

export const intentScanFanOut = inngest.createFunction(
  {
    id: "cro-intent-scan-fanout",
    name: "CRO: Intent Scan Fan-Out",
    triggers: [{ cron: "15 */6 * * *" }],
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
    name: "CRO: Intent Signal Scanner",
    retries: 2,
    concurrency: { limit: 2 },
    triggers: [{ event: "juno/intent.scan.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, {
        queryHint: "audit compliance finance accounting software ICP",
      }),
    )

    if (!context) {
      return { userId, saved: 0, reason: "no_company_profile" }
    }

    const keywords = buildKeywordList(context.extracted.keywords)
    const xWatchTerms = buildXWatchTermsFromContext(context)

    const [redditSignals, hnSignals, xSignals] = await step.run("scan-platforms", async () => {
      const [r, h, x] = await Promise.all([
        scanRedditForIntent(keywords, REDDIT_SUBREDDITS),
        scanHNForIntent(keywords),
        hasXRecentSearchConfig() ? scanXForIntent(xWatchTerms) : Promise.resolve([]),
      ])
      return [r, h, x] as const
    })

    const raw = [...redditSignals, ...hnSignals, ...xSignals]
    if (raw.length === 0) {
      return { userId, scanned: 0, saved: 0, reason: "no_candidates" }
    }

    const scored = await step.run("score-intents", () =>
      scoreIntentSignals(raw.slice(0, 40), context),
    )

    const toSave = scored.filter((s) => s.relevanceScore >= 4)
    const hot = scored.filter((s) => s.relevanceScore >= 8)

    if (hot.length > 0) {
      console.log(`[intent-scanner] user=${userId} hot signals: ${hot.length}`, hot.map((h) => h.url))
    }

    let saved = 0
    await step.run("persist-signals", async () => {
      for (const s of toSave) {
        const { error } = await supabaseAdmin.from("intent_signals").insert({
          user_id: userId,
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

    return {
      userId,
      scanned: raw.length,
      scored: scored.length,
      saved,
      hot: hot.length,
      ...(saved === 0 && scored.length > 0 ? { reason: "all_below_threshold" as const } : {}),
    }
  },
)
