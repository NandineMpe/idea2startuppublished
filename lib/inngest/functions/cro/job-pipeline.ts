import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { generateOutreach, scoreLeadFit } from "@/lib/juno/ai-engine"
import { insertContentCalendarRow } from "@/lib/content-calendar"
import { saveContentToDB, saveLeadToDB } from "@/lib/juno/delivery"
import { resolveDomainForTheOrgLookup } from "@/lib/juno/theorg"
import { jackJillRowsToJobListings, mergeJobListings, scrapeJobBoards } from "@/lib/juno/scrapers"
import { getFanOutUserIds } from "@/lib/juno/users"
import type { JobListing, LeadDiscoveredPayload, LeadFitResult } from "@/lib/juno/types"

type ScoredJobLead = JobListing & LeadFitResult

// ─── Fan-out ─────────────────────────────────────────────────────

export const jobScanFanOut = inngest.createFunction(
  {
    id: "cro-job-scan-fanout",
    name: "CRO: Job Scan Fan-Out",
    triggers: [{ cron: "0 */6 * * *" }],
  },
  async ({ step }) => {
    const userIds = await step.run("load-users", getFanOutUserIds)
    if (userIds.length > 0) {
      await step.sendEvent(
        "fan-out-jobs-scan",
        userIds.map((userId) => ({
          name: "juno/jobs.scan.requested" as const,
          data: { userId },
        })),
      )
    }
    return { users: userIds.length }
  },
)

// ─── Per-user job board scanner ──────────────────────────────────

export const jobBoardScanner = inngest.createFunction(
  {
    id: "cro-job-board-scanner",
    name: "CRO: Job Board Scanner",
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: "juno/jobs.scan.requested" }],
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string }

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, {
        queryHint: "customers hiring ICP target market product value",
      }),
    )

    if (!context) {
      return { userId, found: 0, qualified: 0, reason: "no_company_profile" }
    }

    const { keywords } = context.extracted
    const kw = keywords.length > 0 ? keywords : ["startup", "software", "remote"]

    const jackJill = jackJillRowsToJobListings(context.profile.raw?.jack_jill_jobs)
    const listings = await step.run("scan-boards", async () => {
      const scraped = await scrapeJobBoards({
        keywords: kw,
        allowStub: jackJill.length === 0,
      })
      return mergeJobListings(jackJill, scraped)
    })

    if (listings.length === 0) {
      return { userId, found: 0, qualified: 0 }
    }

    const scoredLeads = await step.run("score-leads", async (): Promise<ScoredJobLead[]> => {
      const results: ScoredJobLead[] = []
      for (const listing of listings.slice(0, 15)) {
        try {
          const score = await scoreLeadFit({
            context,
            company: listing.company,
            role: listing.title,
            description: listing.description,
          })
          if (score.icpFit >= 6) {
            results.push({ ...listing, ...score })
          }
        } catch (e) {
          console.error(`[CRO] Score failed for ${listing.company}:`, e)
        }
      }
      return results
    })

    for (const [i, lead] of scoredLeads.entries()) {
      const leadId = await step.run(`persist-lead-${i}`, () =>
        saveLeadToDB({
          userId,
          company: lead.company,
          role: lead.title,
          url: lead.url,
          companyDomain: resolveDomainForTheOrgLookup(lead.company, lead.url, lead.source),
          score: lead.icpFit,
          pitchAngle: lead.pitchAngle,
          source: lead.source,
        }),
      )

      await step.sendEvent(`lead-discovered-${i}`, {
        name: "juno/lead.discovered" as const,
        data: {
          userId,
          company: lead.company,
          role: lead.title,
          url: lead.url,
          score: lead.icpFit,
          pitchAngle: lead.pitchAngle,
          source: lead.source,
        } satisfies LeadDiscoveredPayload,
      })

      if (typeof leadId === "string" && lead.icpFit >= 7) {
        await step.sendEvent(`lead-qualified-${i}`, {
          name: "juno/lead.qualified" as const,
          data: {
            leadId,
            userId,
            companyName: lead.company,
            companyDomain: resolveDomainForTheOrgLookup(lead.company, lead.url, lead.source),
            jobTitle: lead.title,
            jobUrl: lead.url,
            pitchAngle: lead.pitchAngle,
            score: lead.icpFit,
            source: lead.source,
          },
        })
      }
    }

    if (scoredLeads.length > 0) {
      await step.run("write-leads-to-vault", async () => {
        const { writeVaultFile } = await import("@/lib/juno/vault")
        const date = new Date().toISOString().split("T")[0]
        const md = [
          `---`,
          `date: ${date}`,
          `type: cro-leads`,
          `count: ${scoredLeads.length}`,
          `---`,
          ``,
          `# Leads — ${date}`,
          ``,
          ...scoredLeads.map(
            (l) =>
              `## ${l.company} — ${l.title}\n\n- Fit: ${l.icpFit}/10\n- Angle: ${l.pitchAngle}\n- Source: ${l.source}${l.url ? `\n- ${l.url}` : ""}\n`,
          ),
        ].join("\n")
        const r = await writeVaultFile(`juno/leads/${date}.md`, md, `Juno: Leads ${date}`, userId)
        if (!r.success && r.error) {
          console.warn("[CRO] vault write:", r.error)
        }
      })
    }

    return {
      userId,
      found: listings.length,
      qualified: scoredLeads.length,
    }
  },
)

// ─── Lead outreach (event-driven) ────────────────────────────────

export const leadOutreach = inngest.createFunction(
  {
    id: "cro-lead-outreach",
    name: "CRO: Lead Outreach",
    retries: 1,
    concurrency: { limit: 2 },
    triggers: [{ event: "juno/lead.discovered" }],
  },
  async ({ event, step }) => {
    const data = event.data as LeadDiscoveredPayload
    const { userId, company, role, url, pitchAngle, score } = data

    if (typeof score !== "number" || score < 7) {
      return { skipped: true as const, reason: "below_score_threshold" }
    }

    const context = await step.run("load-context", () =>
      getCompanyContext(userId, { queryHint: "product value proposition customers" }),
    )

    if (!context) {
      return { skipped: true as const, reason: "no_company_profile" }
    }

    const outreach = await step.run("generate-outreach", () =>
      generateOutreach({
        context,
        company,
        role,
        jobUrl: url,
        pitchAngle,
      }),
    )

    const outreachContentId = await step.run("save-outreach", () =>
      saveContentToDB({
        userId,
        platform: "linkedin",
        contentType: "outreach",
        body: JSON.stringify(outreach),
        status: "pending_approval",
      }),
    )

    await step.run("calendar-outreach", async () => {
      await insertContentCalendarRow({
        userId,
        title: `Outreach: ${company} — ${role}`,
        body: JSON.stringify(outreach),
        channel: "linkedin",
        contentType: "outreach",
        scheduledDate: new Date().toISOString().split("T")[0],
        status: "draft",
        source: "cro_outreach",
        sourceRef: outreachContentId ?? undefined,
        targetAudience: `${role} at ${company}`,
      })
    })

    return { userId, company, generated: true as const }
  },
)
