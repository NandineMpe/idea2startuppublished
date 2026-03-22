import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { getFanOutUserIds } from "@/lib/juno/users"
import {
  scrapeArxiv,
  scrapeHackerNews,
  scrapeNews,
  scrapeProductHunt,
  scrapeRegulation,
} from "@/lib/juno/scrapers"
import { formatBrief } from "@/lib/juno/brief-formatter"
import { saveBriefToDB, sendWhatsAppToUser } from "@/lib/juno/delivery"
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

    const [arxiv, hn, news, ph, regulation] = await Promise.all([
      step.run("scrape-arxiv", () => scrapeArxiv(kw)),
      step.run("scrape-hn", () => scrapeHackerNews([...kw, ...comp])),
      step.run("scrape-news", () => scrapeNews({ competitors: comp, keywords: kw })),
      step.run("scrape-ph", () => scrapeProductHunt(kw)),
      step.run("scrape-regulation", () => scrapeRegulation()),
    ])

    const allItems = [...arxiv, ...hn, ...news, ...ph, ...regulation]

    const scored = await step.run("score-items", () => scoreItems(allItems, context))

    const brief = await step.run("format-brief", () => formatBrief(scored, allItems.length))

    await Promise.all([
      step.run("save-to-db", () =>
        saveBriefToDB({
          userId,
          brief: {
            markdown: brief.email,
            dashboard: brief.dashboard,
            whatsapp: brief.whatsapp,
          },
          rawItemCount: allItems.length,
          scoredItemCount: scored.length,
          briefDateIso: brief.briefDateIso,
        }),
      ),
      step.run("send-whatsapp", async () => {
        const r = await sendWhatsAppToUser(userId, brief.whatsapp)
        if (!r.success) {
          console.log("[CBS Brief] (no verified WhatsApp — logging)", brief.whatsapp.slice(0, 600))
        }
        return r
      }),
    ])

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
        arxiv: arxiv.length,
        hn: hn.length,
        news: news.length,
        ph: ph.length,
        regulation: regulation.length,
      },
    }
  },
)
