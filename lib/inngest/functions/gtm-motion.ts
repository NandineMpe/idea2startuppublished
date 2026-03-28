import { inngest } from "@/lib/inngest/client"
import { getCompanyContext } from "@/lib/company-context"
import { supabaseAdmin } from "@/lib/supabase"
import {
  draftOutreachEmail,
  researchCompany,
  selectBestContacts,
} from "@/lib/juno/gtm-outreach"
import {
  getContactDetails,
  lookupOrgChart,
  MANUAL_OUTREACH_EMAIL_PLACEHOLDER,
  resolveDomainForTheOrgLookup,
  type OrgPerson,
} from "@/lib/juno/theorg"
import type { LeadQualifiedPayload } from "@/lib/juno/types"

const TARGET_FUNCTIONS = [
  "AI",
  "innovation",
  "digital",
  "audit",
  "finance",
  "compliance",
  "technology",
  "data",
  "information",
]

async function loadLookalikePlaybook(userId: string): Promise<{ id: string; text: string } | null> {
  const { data } = await supabaseAdmin
    .from("lookalike_profiles")
    .select("id, outreach_playbook")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.outreach_playbook) return null
  return {
    id: data.id,
    text:
      typeof data.outreach_playbook === "object"
        ? JSON.stringify(data.outreach_playbook, null, 2)
        : String(data.outreach_playbook),
  }
}

export const gtmMotion = inngest.createFunction(
  {
    id: "gtm-motion",
    name: "GTM: Outreach pipeline",
    retries: 2,
    concurrency: { limit: 3 },
    triggers: [{ event: "juno/lead.qualified" }],
  },
  async ({ event, step }) => {
    const d = event.data as LeadQualifiedPayload
    const {
      leadId,
      userId,
      companyName,
      companyDomain,
      jobTitle,
      jobUrl,
      source,
    } = d

    if (!leadId || !userId || !companyName?.trim() || !jobTitle?.trim()) {
      return { skipped: true as const, reason: "missing_fields" }
    }

    const domainHint =
      companyDomain?.trim() ||
      resolveDomainForTheOrgLookup(companyName.trim(), jobUrl ?? null, source ?? null) ||
      null

    const orgChart = await step.run("lookup-org-chart", async () =>
      lookupOrgChart(companyName.trim(), domainHint, TARGET_FUNCTIONS),
    )

    const research = await step.run("research-company", async () =>
      researchCompany(companyName.trim(), jobTitle.trim(), orgChart),
    )

    const contacts = await step.run("identify-contacts", async () => {
      if (!orgChart || (orgChart.relevantContacts.length === 0 && orgChart.people.length === 0)) {
        return [] as OrgPerson[]
      }
      return selectBestContacts(orgChart, research, jobTitle.trim(), 3)
    })

    if (contacts.length === 0) {
      await step.run("mark-lead-no-contacts", async () => {
        await supabaseAdmin
          .from("cro_leads")
          .update({
            research_status: "no_contacts",
            researched_at: new Date().toISOString(),
            account_intel: {
              orgChart: null,
              research,
              jobUrl: jobUrl ?? null,
            },
          })
          .eq("id", leadId)
          .eq("user_id", userId)
      })
      return { leadId, status: "no_contacts_found" as const }
    }

    const domainForEnrich = orgChart?.companyDomain ?? companyDomain ?? ""

    const enrichedContacts = await step.run("enrich-contacts", async () => {
      const out: OrgPerson[] = []
      for (const c of contacts) {
        if (!domainForEnrich) {
          out.push(c)
          continue
        }
        const details = await getContactDetails(c.chartNodeId, domainForEnrich, c.name)
        out.push({
          ...c,
          email: details.email ?? c.email,
          linkedinUrl: details.linkedin ?? c.linkedinUrl,
        })
      }
      return out
    })

    const context = await step.run("load-context", async () => {
      const ctx = await getCompanyContext(userId, {
        queryHint: "cold email founder voice product value ICP",
      })
      return ctx
    })

    if (!context) {
      return { skipped: true as const, reason: "no_company_profile" }
    }

    const playbookRow = await step.run("load-lookalike", async () =>
      loadLookalikePlaybook(userId),
    )

    const drafts = await step.run("draft-emails", async () => {
      const emailDrafts: Array<{
        contact: OrgPerson
        subject: string
        body: string
        toEmail: string
        recipientEmailUnknown: boolean
      }> = []

      for (const contact of enrichedContacts) {
        const hasRealEmail = Boolean(contact.email?.trim())
        const toEmail = hasRealEmail ? contact.email!.trim() : MANUAL_OUTREACH_EMAIL_PLACEHOLDER

        const draft = await draftOutreachEmail({
          contact: { ...contact, email: toEmail },
          companyResearch: research,
          orgChart,
          context,
          jobTitle: jobTitle.trim(),
          companyName: companyName.trim(),
          lookalikePlaybook: playbookRow?.text,
          recipientEmailUnknown: !hasRealEmail,
        })

        if (draft.subject && draft.body) {
          emailDrafts.push({
            contact,
            subject: draft.subject,
            body: draft.body,
            toEmail,
            recipientEmailUnknown: !hasRealEmail,
          })
        }
      }
      return emailDrafts
    })

    await step.run("save-drafts", async () => {
      for (const draft of drafts) {
        const { error } = await supabaseAdmin.from("outreach_log").insert({
          user_id: userId,
          lead_id: leadId,
          to_name: draft.contact.name,
          to_email: draft.toEmail,
          to_title: draft.contact.title,
          to_company: companyName.trim(),
          subject: draft.subject,
          body: draft.body,
          channel: "email",
          status: "drafted",
          lookalike_profile_id: playbookRow?.id ?? null,
        })
        if (error) console.error("[gtm-motion] outreach_log insert:", error.message)
      }
    })

    await step.run("update-lead", async () => {
      const { error } = await supabaseAdmin
        .from("cro_leads")
        .update({
          account_intel: {
            orgChart: orgChart
              ? {
                  relevantContacts: orgChart.relevantContacts,
                  orgStructure: orgChart.orgStructure,
                  companyDomain: orgChart.companyDomain,
                }
              : null,
            research,
            jobUrl: jobUrl ?? null,
          },
          research_status: "complete",
          researched_at: new Date().toISOString(),
        })
        .eq("id", leadId)
        .eq("user_id", userId)

      if (error) console.error("[gtm-motion] cro_leads update:", error.message)
    })

    return {
      leadId,
      companyName,
      contactsFound: enrichedContacts.length,
      emailsDrafted: drafts.length,
      status: "awaiting_approval" as const,
    }
  },
)
