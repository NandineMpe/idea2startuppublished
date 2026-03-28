import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { getFanOutUserIds } from "@/lib/juno/users"
import {
  dedupeByUrl,
  filterToLast24Hours,
  scrapeArxiv,
  scrapeCBSSources,
  scrapeHackerNews,
} from "@/lib/juno/scrapers"
import {
  loadCompetitorContext30d,
  loadFundingContext90d,
  loadCompetitorTrackingForVault,
  loadFundingTrackerForVault,
  persistCompetitorEvents,
} from "@/lib/juno/competitor-persistence"
import { buildCompetitorVaultMarkdown } from "@/lib/juno/competitor-vault"
import { formatBrief, formatBriefForVault } from "@/lib/juno/brief-formatter"
import { saveBriefToDB } from "@/lib/juno/delivery"
import { scoreItems } from "@/lib/juno/scoring"
import type { DailyBriefPayload, ScoredItem } from "@/lib/juno/types"

// ─── Fan-out ─────────────────────────────────────────────────────

export const dailyBriefFanOut = inngest.createFunction(
  {
    id: "cbs-daily-brief-fanout",
    name: "CBS: Daily Brief Fan-Out",
    triggers: [{ cron: "0 5 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getFanOutUserIds)

    if (userIds.length > 0) {
      await step.sendEvent(
        "fan-out-brief-requested",
        userIds.map((userId) => ({
          name: "juno/brief.requested" as const,
          data: { userId },
        })),
      )
    }

    return { users: userIds.length }
  },
)

// ─── Per-user daily brief ────────────────────────────────────────

export const dailyBrief = inngest.createFunction(
  {
    id: "cbs-daily-brief",
    name: "CBS: Zazu Daily Brief",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: [{ event: "juno/brief.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, {
        queryHint: "competitors market industry funding strategy",
      }),
    )

    if (!context) {
      await step.sendEvent("brief-generated-empty", {
        name: "juno/brief.generated",
        data: {
          userId,
          briefMarkdown: "_No company profile — complete /dashboard/company to enable the daily brief._",
          scoredItems: [] as ScoredItem[],
          generatedAt: new Date().toISOString(),
          briefDate: new Date().toISOString().slice(0, 10),
          itemCount: 0,
        } satisfies DailyBriefPayload,
      })
      return { skipped: true, reason: "no_company_profile" }
    }

    const { keywords, competitors } = context.extracted
    const kw = keywords.length > 0 ? keywords : ["startup", "artificial intelligence", "funding"]
    const comp = competitors.length > 0 ? competitors : []

    const [cbsItems, arxiv, hn] = await Promise.all([
      step.run("scrape-cbs-sources", () => scrapeCBSSources(kw, comp)),
      step.run("scrape-arxiv", () => scrapeArxiv(kw)),
      step.run("scrape-hn", () => scrapeHackerNews([...kw, ...comp])),
    ])

    const merged = dedupeByUrl([...cbsItems, ...arxiv, ...hn])
    // Strict 24h window only — no backfill if a cron run was skipped; stale items never reach scoring.
    const allItems = filterToLast24Hours(merged)

    const scored = await step.run("score-items", () => scoreItems(allItems, context))

    await step.run("persist-competitor-events", () => persistCompetitorEvents(userId, scored, context))

    const persistent = await step.run("load-persistent-brief-context", async () => {
      const [recentCompetitorEvents, recentFunding] = await Promise.all([
        loadCompetitorContext30d(userId),
        loadFundingContext90d(userId),
      ])
      return { recentCompetitorEvents, recentFunding }
    })

    const brief = await step.run("format-brief", () =>
      formatBrief(scored, allItems.length, persistent),
    )

    await step.run("save-to-db", () =>
      saveBriefToDB({
        userId,
        brief: {
          markdown: brief.email,
          dashboard: brief.dashboard,
        },
        rawItemCount: allItems.length,
        scoredItemCount: scored.length,
        briefDateIso: brief.briefDateIso,
        scoredItems: scored,
      }),
    )

    await step.run("write-to-vault", async () => {
      const { writeVaultFile } = await import("@/lib/juno/vault")
      const date = brief.briefDateIso
      const markdown = formatBriefForVault(scored, date, { sourcesScraped: allItems.length })
      const r = await writeVaultFile(`juno/briefs/${date}.md`, markdown, `Juno: Daily brief for ${date}`, userId)
      if (!r.success && r.error) {
        console.warn("[CBS Brief] vault write:", r.error)
      }
    })

    await step.run("write-competitors-vault", async () => {
      const { writeVaultFile } = await import("@/lib/juno/vault")
      const [events, funding] = await Promise.all([
        loadCompetitorTrackingForVault(userId),
        loadFundingTrackerForVault(userId),
      ])
      const md = buildCompetitorVaultMarkdown(events, funding, brief.briefDateIso)
      const r = await writeVaultFile(
        "juno/competitors.md",
        md,
        `Juno: Updated competitor landscape (${brief.briefDateIso})`,
        userId,
      )
      if (!r.success && r.error && r.error !== "Vault not configured") {
        console.warn("[CBS Brief] competitors vault:", r.error)
      }
    })

    const payload: DailyBriefPayload = {
      userId,
      briefDate: brief.briefDateIso,
      itemCount: scored.length,
      briefMarkdown: brief.email,
      scoredItems: scored.slice(0, 10),
      generatedAt: brief.dashboard.generatedAt,
    }

    await step.sendEvent("brief-generated", {
      name: "juno/brief.generated",
      data: payload,
    })

    return {
      userId,
      scraped: allItems.length,
      scored: scored.length,
      sources: {
        cbs_rss: cbsItems.length,
        arxiv: arxiv.length,
        hn_api: hn.length,
        merged: merged.length,
      },
    }
  },
)
