/**
 * GTM Motion — account research, contact selection, cold email drafting.
 */

import { appendWritingRules } from "@/lib/copy-writing-rules"
import type { CompanyContext } from "@/lib/company-context"
import type { OrgChartResult, OrgPerson } from "@/lib/juno/theorg"
import { isLlmConfigured, qwenModel } from "@/lib/llm-provider"
import { generateText } from "ai"

export type AccountResearch = {
  summary: string
  aiStance: string
  newsHooks: string[]
  outreachAngle: string
  bestContact?: { name: string; title: string; reason: string }
  secondContact?: { name: string; title: string; reason: string }
  internalChampion?: { name: string; title: string; reason: string }
}

export async function researchCompany(
  companyName: string,
  jobTitle: string,
  orgChart: OrgChartResult | null,
): Promise<AccountResearch> {
  const empty: AccountResearch = {
    summary: "",
    aiStance: "unknown",
    newsHooks: [],
    outreachAngle: "",
  }
  if (!isLlmConfigured()) return empty

  const orgBlock = orgChart
    ? `ORG CHART (TheOrg):
${orgChart.orgStructure}

RELEVANT DECISION-MAKERS:
${orgChart.relevantContacts
  .map((c) => `- ${c.name}: ${c.title}${c.email ? ` (${c.email})` : ""}`)
  .join("\n")}
`
    : "No org chart data available."

  const userPrompt = `Research this company for a B2B sales opportunity. Use public knowledge for recent news, hiring, or initiatives when helpful.

COMPANY: ${companyName}
JOB POSTING / ROLE SIGNAL: ${jobTitle}

${orgBlock}

Return JSON only:
{
  "summary": "2-4 sentences on what they do and why they might buy automation/AI tools now",
  "aiStance": "how they talk about AI / digital (inferred or known)",
  "newsHooks": ["up to 3 concrete hooks: initiatives, launches, M&A, hiring themes — short"],
  "outreachAngle": "one sentence on the best narrative for a founder reaching out",
  "bestContact": {"name":"","title":"","reason":""} or null,
  "secondContact": {"name":"","title":"","reason":""} or null,
  "internalChampion": {"name":"","title":"","reason":""} or null
}

Use org chart names/titles when picking contacts; if org chart empty, set those three to null.`

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 2000,
    messages: [{ role: "user", content: appendWritingRules(userPrompt) }],
  })

  let body = text?.trim() ?? ""
  if (!body) {
    const retry = await generateText({
      model: qwenModel(),
      maxOutputTokens: 2000,
      messages: [{ role: "user", content: appendWritingRules(userPrompt) }],
    })
    body = retry.text?.trim() ?? ""
  }

  try {
    const parsed = JSON.parse(body.match(/\{[\s\S]*\}/)?.[0] || "{}") as Partial<AccountResearch>
    return {
      summary: String(parsed.summary ?? ""),
      aiStance: String(parsed.aiStance ?? ""),
      newsHooks: Array.isArray(parsed.newsHooks) ? parsed.newsHooks.map(String) : [],
      outreachAngle: String(parsed.outreachAngle ?? ""),
      bestContact: parsed.bestContact,
      secondContact: parsed.secondContact,
      internalChampion: parsed.internalChampion,
    }
  } catch {
    return { ...empty, summary: body.slice(0, 500) }
  }
}

export async function selectBestContacts(
  orgChart: OrgChartResult,
  research: AccountResearch,
  jobTitle: string,
  maxContacts: number,
): Promise<OrgPerson[]> {
  if (!isLlmConfigured()) {
    return orgChart.relevantContacts.slice(0, maxContacts)
  }

  const pool = orgChart.relevantContacts.length > 0 ? orgChart.relevantContacts : orgChart.people
  if (pool.length === 0) return []
  if (pool.length <= maxContacts) return pool

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 800,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`Pick up to ${maxContacts} best people to cold-email first for a founder selling into this account.

JOB SIGNAL: ${jobTitle}

RESEARCH:
${JSON.stringify(research, null, 2)}

CANDIDATES (use positionId to identify):
${pool.map((p) => `- positionId=${p.positionId} chartNodeId=${p.chartNodeId} | ${p.name} | ${p.title}`).join("\n")}

Return JSON: { "positionIds": ["..."] } — ordered best first, max ${maxContacts} entries, only IDs from the list.`),
      },
    ],
  })

  const raw = text?.trim() ?? ""
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      positionIds?: string[]
    }
    const ids = Array.isArray(parsed.positionIds) ? parsed.positionIds : []
    const ordered: OrgPerson[] = []
    for (const id of ids) {
      const p = pool.find((x) => x.positionId === id || x.chartNodeId === id)
      if (p) ordered.push(p)
    }
    if (ordered.length > 0) return ordered.slice(0, maxContacts)
  } catch {
    /* fall through */
  }
  return pool.slice(0, maxContacts)
}

export async function draftOutreachEmail(params: {
  contact: OrgPerson
  companyResearch: AccountResearch
  orgChart: OrgChartResult | null
  context: CompanyContext
  jobTitle: string
  companyName: string
  lookalikePlaybook?: string
  /** True when TheOrg did not return a work email — founder sends manually. */
  recipientEmailUnknown?: boolean
}): Promise<{ subject: string; body: string }> {
  const empty = { subject: "", body: "" }
  if (!isLlmConfigured()) return empty

  const p = params.context.profile
  const voice = p.brand_voice_dna?.trim() || p.brand_voice?.trim() || ""
  const coldChannel = p.brand_channel_voice?.cold_email?.trim() || ""

  const playbook = params.lookalikePlaybook?.trim()
    ? `\nLOOKALIKE / PROVEN PLAYBOOK:\n${params.lookalikePlaybook.trim()}\n`
    : ""

  const orgCtx = params.orgChart
    ? `ORG CONTEXT:\n${params.orgChart.orgStructure}\n`
    : ""

  const emailNote = params.recipientEmailUnknown
    ? "\nNOTE: We do not have their work email on file — the founder will send this from their own mail client. Do not mention missing email or placeholders in the body.\n"
    : ""

  const { text } = await generateText({
    model: qwenModel(),
    maxOutputTokens: 1200,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`Write a cold outreach email from a startup founder.

${params.context.promptBlock}

THE SENDER:
${p.founder_name || "Founder"}, ${p.name || "our company"}
Background: ${p.founder_background || "—"}
Voice DNA:
${voice || "—"}
Cold email channel notes: ${coldChannel || "—"}
Words we lean on: ${(p.brand_words_use ?? []).join(", ") || "—"}
Words we avoid: ${(p.brand_words_never ?? []).join(", ") || "—"}
Credibility hooks (use one in P.S. if natural): ${(p.brand_credibility_hooks ?? []).join(" | ") || "—"}
${playbook}
THE RECIPIENT:
Name: ${params.contact.name}
Title: ${params.contact.title}
Company: ${params.companyName}
Reports to: ${params.contact.reportsTo || "unknown"}
${params.contact.email && !params.recipientEmailUnknown ? `Email: ${params.contact.email}` : ""}
${emailNote}
JOB THAT TRIGGERED THIS: ${params.jobTitle}

COMPANY RESEARCH:
${JSON.stringify(params.companyResearch, null, 2)}

${orgCtx}

RULES:
1. Subject: 6-10 words, specific to THEM, not about us.
2. No "I hope this email finds you well" / "I'm reaching out because…"
3. Open with something specific (role, initiative, or research hook).
4. Pain: 1-2 sentences tying their situation to the problem we solve.
5. Offer: 1 sentence — what we do, relevant to them.
6. Ask: "Worth a 15-minute chat?" (not a demo request).
7. P.S. one credibility line if it fits.
8. Under 150 words. Plain text. No HTML.

Return JSON: {"subject":"...","body":"..."}`),
      },
    ],
  })

  const raw = text?.trim() ?? ""
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      subject?: string
      body?: string
    }
    return {
      subject: String(parsed.subject ?? "").slice(0, 300),
      body: String(parsed.body ?? ""),
    }
  } catch {
    return empty
  }
}
