import { inngest } from "@/lib/inngest/client"
import { getCompanyContextForJobs } from "@/lib/company-context-admin"
import { fetchAllBriefSources } from "@/lib/juno/scrapers"
import { generateBriefMarkdown, scoreItemsAgainstProfile } from "@/lib/juno/scoring"
import { formatBriefForWhatsApp } from "@/lib/juno/brief-format"
import { sendWhatsAppDailyBrief } from "@/lib/juno/whatsapp"
import { getJunoTargetUserIds } from "@/lib/juno/users"
import type { DailyBriefPayload } from "@/lib/juno/types"

/** 5am UTC — adjust in Inngest dashboard or change cron for local TZ. */
export const dailyBriefOrchestrator = inngest.createFunction(
  {
    id: "juno-cbs-daily-brief-orchestrator",
    name: "CBS · Daily brief fan-out",
    triggers: [{ cron: "0 5 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("list-target-users", getJunoTargetUserIds)
    if (userIds.length === 0) {
      return { sent: 0, note: "Set JUNO_TEST_USER_ID or SUPABASE_SERVICE_ROLE_KEY" }
    }
    await step.sendEvent(
      "fan-out-daily-brief",
      userIds.map((userId) => ({ name: "juno/daily-brief.run", data: { userId } })),
    )
    return { sent: userIds.length }
  },
)

export const dailyBriefRun = inngest.createFunction(
  {
    id: "juno-cbs-daily-brief-run",
    name: "CBS · Daily brief (scrape → score → brief → WhatsApp → brief.generated)",
    triggers: [{ event: "juno/daily-brief.run" }],
  },
  async ({ event, step }) => {
    const userId = (event.data as { userId?: string }).userId
    if (!userId) throw new Error("daily-brief.run missing userId")

    const companyContext = await step.run("load-company-context", () => getCompanyContextForJobs(userId))

    const arxivQuery = await step.run("arxiv-query", async () => {
      const low = companyContext.toLowerCase()
      if (low.includes("finance") || low.includes("fintech")) return "all:finance+OR+all:llm"
      if (low.includes("health")) return "all:healthcare+AI"
      return "cat:cs.AI+OR+all:startup+funding"
    })

    const rawItems = await step.run("fetch-sources", () => fetchAllBriefSources(arxivQuery))

    const scored = await step.run("score-items", () => scoreItemsAgainstProfile(companyContext, rawItems))

    const briefMarkdown = await step.run("generate-brief", () =>
      generateBriefMarkdown(companyContext, scored),
    )

    await step.run("whatsapp-delivery", async () => {
      const to = process.env.JUNO_WHATSAPP_TO
      const body = formatBriefForWhatsApp(`*Juno Daily Brief*\n\n${briefMarkdown}`)
      return sendWhatsAppDailyBrief(to, body)
    })

    const payload: DailyBriefPayload = {
      userId,
      briefMarkdown,
      scoredItems: [...scored].sort((a, b) => b.score - a.score).slice(0, 8),
      generatedAt: new Date().toISOString(),
    }

    await step.sendEvent("brief-generated", {
      name: "juno/brief.generated",
      data: payload,
    })

    return { ok: true, userId, items: rawItems.length }
  },
)
