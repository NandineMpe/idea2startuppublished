import { anthropic } from "@ai-sdk/anthropic"
import { generateText } from "ai"
import { inngest } from "@/lib/inngest/client"
import { getCompanyContextForJobs } from "@/lib/company-context-admin"
import { getJunoTargetUserIds } from "@/lib/juno/users"
import type { EnrichedLeadPayload, LeadPayload } from "@/lib/juno/types"

/** Every 4 hours — stub lead until job boards API is wired. */
export const jobBoardScanner = inngest.createFunction(
  {
    id: "juno-cro-job-board-scanner",
    name: "CRO · Job board scanner (stub → lead.discovered)",
    triggers: [{ cron: "0 */4 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("users", getJunoTargetUserIds)
    const userId = userIds[0]
    if (!userId) return { skipped: true }

    await step.sendEvent("lead-discovered", {
      name: "juno/lead.discovered",
      data: {
        userId,
        company: "Profound (example)",
        role: "Controller",
        sourceUrl: "https://example.com/jobs/stub",
        snippet: "Stub: wire LinkedIn Jobs / Indeed in lib/juno/scrapers job-boards",
      } satisfies LeadPayload,
    })

    return { ok: true, userId }
  },
)

export const leadEnrichment = inngest.createFunction(
  {
    id: "juno-cro-lead-enrichment",
    name: "CRO · Lead enrichment",
    triggers: [{ event: "juno/lead.discovered" }],
  },
  async ({ event, step }) => {
    const lead = event.data as LeadPayload
    const ctx = await step.run("context", () => getCompanyContextForJobs(lead.userId))

    const enrichment = await step.run("enrich", async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        return "Stub enrichment — set ANTHROPIC_API_KEY. Company: " + lead.company
      }
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        maxTokens: 1200,
        system:
          "You are CRO. Enrich this hiring signal: company fit, angle for outreach, 5 bullet facts (inferred OK if needed). Markdown.",
        prompt: `Company context:\n${ctx.slice(0, 6000)}\n\nLead:\n${JSON.stringify(lead)}`,
      })
      return text
    })

    const enriched: EnrichedLeadPayload = { ...lead, enrichment }

    await step.sendEvent("lead-enriched", {
      name: "juno/lead.enriched",
      data: enriched,
    })

    return { ok: true }
  },
)

export const outreachDraft = inngest.createFunction(
  {
    id: "juno-cro-outreach-draft",
    name: "CRO/CMO · Outreach draft (WhatsApp approval stub)",
    triggers: [{ event: "juno/lead.enriched" }],
  },
  async ({ event, step }) => {
    const lead = event.data as EnrichedLeadPayload

    const draft = await step.run("draft-outreach", async () => {
      if (!process.env.ANTHROPIC_API_KEY) {
        return "Stub outreach — connect Claude"
      }
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        maxTokens: 800,
        system: "Draft a short cold DM / email (under 200 words) to a hiring lead. Professional, specific.",
        prompt: `${JSON.stringify(lead)}`,
      })
      return text
    })

    console.log("[juno/outreach] approval queue (stub):\n", draft.slice(0, 400))

    return { ok: true, userId: lead.userId }
  },
)
