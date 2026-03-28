import Anthropic from "@anthropic-ai/sdk"
import { appendWritingRules } from "@/lib/copy-writing-rules"
import type { CompanyContext } from "@/lib/company-context"
import type {
  LookalikeDimensions,
  LookalikeStats,
  OutreachPlaybook,
} from "@/types/lookalike"
import { normalizeDimensions, normalizeOutreachPlaybook, normalizeStats } from "./normalize"
import { DEFAULT_STATS } from "./defaults"
import { fallbackDimensionsFromConversion, fallbackPlaybook } from "./fallback-profile"
import { generatePlatformQueries, platformQueriesToLegacySearch } from "./generate-queries"
import { dimensionsToLegacyCriteria } from "./derive-legacy"

const anthropic = new Anthropic()

function extractText(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { text: string }).text)
    .join("")
}

export function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

function resolveSimilarLeadIndices(
  snippets: Array<{ company: string; role: string; contactName?: string }>,
  indices: unknown,
): Array<{ company: string; role: string; contactName?: string }> {
  if (!Array.isArray(indices) || snippets.length === 0) return []
  const seen = new Set<string>()
  const out: Array<{ company: string; role: string; contactName?: string }> = []
  for (const raw of indices) {
    const i = Math.floor(Number(raw))
    if (!Number.isFinite(i) || i < 1 || i > snippets.length) continue
    const s = snippets[i - 1]
    const k = `${s.company}|${s.role}`.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ company: s.company, role: s.role, contactName: s.contactName })
  }
  return out.slice(0, 20)
}

export type LookalikeConversionAnalysis = {
  profileName: string
  dimensions: LookalikeDimensions
  outreachPlaybook: OutreachPlaybook
  convertedLead: {
    name: string
    roleTitle: string
    company: string
    location?: string
    channel: string
    responseTime: string
    multiplierNote: string
  }
  rationale: string
  searchQueries: {
    linkedinSalesNav: string
    apollo: string
    linkedinBoolean: string
    apolloAppUrl: string
  }
  templates: { inmail: string; coldEmail: string }
  pitchAngle: string
  segmentTag: string
  insightsHeadline: string
  proactiveMessage: string
  similarExistingLeadsCount: number
  similarExistingLeads: Array<{ company: string; role: string; contactName?: string }>
  stats: LookalikeStats
  platformQueries: ReturnType<typeof generatePlatformQueries>
}

function playbookToTemplates(p: OutreachPlaybook): { inmail: string; coldEmail: string } {
  return {
    inmail: p.messageTemplate.linkedin,
    coldEmail: p.messageTemplate.email,
  }
}

export async function runLookalikeConversionAnalysis(params: {
  context: CompanyContext
  conversion: {
    name: string
    title: string
    company: string
    location?: string
    whyItWorked?: string
    channel?: string
    responseTime?: string
    companyType?: string
    industry?: string
    companySize?: string
  }
  existingLeadSnippets?: Array<{ company: string; role: string; contactName?: string }>
}): Promise<LookalikeConversionAnalysis> {
  const channel = params.conversion.channel?.trim() || "Not specified — infer best channel"
  const responseTime = params.conversion.responseTime?.trim() || "Not specified"
  const why = params.conversion.whyItWorked?.trim() || ""
  const companyType = params.conversion.companyType?.trim() || ""
  const industry = params.conversion.industry?.trim() || ""
  const companySizeHint = params.conversion.companySize?.trim() || ""

  if (!hasAnthropicKey()) {
    const dimensions = fallbackDimensionsFromConversion({
      name: params.conversion.name,
      title: params.conversion.title,
      company: params.conversion.company,
      location: params.conversion.location,
    })
    const outreachPlaybook = fallbackPlaybook({ channel, responseTime })
    const platformQueries = generatePlatformQueries(dimensions)
    const sq = platformQueriesToLegacySearch(dimensions, platformQueries)
    const legacy = dimensionsToLegacyCriteria(dimensions)
    return {
      profileName: `${legacy.targetTitles[0] ?? "ICP"} — ${params.conversion.company}`,
      dimensions,
      outreachPlaybook,
      convertedLead: {
        name: params.conversion.name,
        roleTitle: params.conversion.title,
        company: params.conversion.company,
        location: params.conversion.location,
        channel,
        responseTime,
        multiplierNote: "Set ANTHROPIC_API_KEY to generate multiplier and lookalike criteria.",
      },
      rationale: outreachPlaybook.rationale,
      searchQueries: sq,
      templates: playbookToTemplates(outreachPlaybook),
      pitchAngle: outreachPlaybook.bestAngle,
      segmentTag: "unknown",
      insightsHeadline: "Log conversions with AI enabled to see segment insights here.",
      proactiveMessage: "Connect ANTHROPIC_API_KEY to scan your saved Juno leads for lookalikes.",
      similarExistingLeadsCount: 0,
      similarExistingLeads: [],
      stats: { ...DEFAULT_STATS },
      platformQueries,
    }
  }

  const snippets =
    params.existingLeadSnippets?.slice(0, 40).map((s, i) => `${i + 1}. ${s.company} — ${s.role}`).join("\n") ||
    "(No saved leads in Juno yet, or list not loaded.)"

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You are Juno's GTM strategist. Build a weighted ideal customer profile from ONE successful conversion. Be specific — this profile will be used to find similar people on LinkedIn and Apollo.

${params.context.promptBlock}

CONVERSION (this person said yes / converted):
- Name: ${params.conversion.name}
- Title / function: ${params.conversion.title}
- Company: ${params.conversion.company}
- Location: ${params.conversion.location || "unknown"}
- Company type (if known): ${companyType || "unknown"}
- Industry (if known): ${industry || "unknown"}
- Company size (if known): ${companySizeHint || "unknown"}
- Channel used: ${channel}
- Response timing: ${responseTime}
- Founder's notes on why it worked: ${why || "—"}

SAVED LEADS ALREADY IN JUNO (numbered lines: company — role). Pick lookalikes that fit the SAME playbook as this conversion (seniority, firm type, motion). Return similarLeadIndices: array of integers — the 1-based line numbers ONLY from this list (no invented rows). Max 15 indices. If none fit, return []. similarExistingLeadsCount must equal the length of similarLeadIndices.
${snippets}

Return ONE JSON object ONLY (no markdown fences). Shape:
{
  "profileName": "short human-readable name e.g. Advisory firm partners in IE/UK",
  "dimensions": {
    "personTitle": { "weight": 0-100, "matchTerms": string[], "excludeTerms": string[], "seniorityMin": "director"|"vp"|"c_level"|"partner"|"" },
    "personFunction": { "weight": number, "functions": string[], "excludeFunctions": string[] },
    "companyType": { "weight": number, "types": string[], "excludeTypes": string[] },
    "companySize": { "weight": number, "minEmployees": number|null, "maxEmployees": number|null, "ranges": string[] },
    "geography": { "weight": number, "countries": string[], "cities": string[], "regions": string[] },
    "industryContext": { "weight": number, "industries": string[], "subVerticals": string[] },
    "multiplierEffect": { "weight": number, "isMultiplier": boolean, "multiplierType": string|null, "estimatedReach": number|null }
  },
  "outreachPlaybook": {
    "bestChannel": string,
    "bestDayOfWeek": string|null,
    "bestAngle": string,
    "averageResponseTime": string|null,
    "rationale": "why this ICP pattern works for the founder's product",
    "messageTemplate": { "linkedin": "InMail with {name},{firstName},{title},{function},{company},{location},{sender_name}", "email": "cold email with Subject: line first, same placeholders" }
  },
  "convertedLead": {
    "name": string,
    "roleTitle": string,
    "company": string,
    "location": string|null,
    "channel": string,
    "responseTime": string,
    "multiplierNote": "one line, HIGH/MEDIUM/LOW prefix when relevant — deal leverage"
  },
  "rationale": string,
  "pitchAngle": string,
  "segmentTag": "short slug e.g. advisory_partner",
  "insightsHeadline": "one punchy dashboard banner line",
  "proactiveMessage": "one sentence using similarExistingLeadsCount",
  "similarLeadIndices": number[]
}

Rules:
- Weights per dimension should sum to roughly 100 across the 7 dimensions (adjust freely).
- GENERALISE slightly from the one conversion so we find SIMILAR people, not clones.
- excludeTerms / excludeFunctions: titles or labels that look like ICP but are not.
- Templates MUST use placeholders: {name}, {firstName}, {title}, {function}, {company}, {location}, {sender_name}
- If channel was unspecified, infer the best channel for this persona and set convertedLead.channel.
- proactiveMessage must reference similarExistingLeadsCount equal to similarLeadIndices.length.`),
      },
    ],
  })

  const text = extractText(response)
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as Record<string, unknown>
    if (!parsed.dimensions || !parsed.outreachPlaybook || !parsed.convertedLead) {
      throw new Error("Incomplete JSON")
    }
    const dimensions = normalizeDimensions(parsed.dimensions)
    const outreachPlaybook = normalizeOutreachPlaybook(parsed.outreachPlaybook)
    const snippetsList = params.existingLeadSnippets ?? []
    const resolvedLeads = resolveSimilarLeadIndices(snippetsList, parsed.similarLeadIndices)

    const platformQueries = generatePlatformQueries(dimensions)
    const sq = platformQueriesToLegacySearch(dimensions, platformQueries)

    const cl = parsed.convertedLead as Record<string, unknown>
    return {
      profileName: String(parsed.profileName ?? `${params.conversion.name} lookalike`),
      dimensions,
      outreachPlaybook,
      convertedLead: {
        name: String(cl.name ?? params.conversion.name),
        roleTitle: String(cl.roleTitle ?? params.conversion.title),
        company: String(cl.company ?? params.conversion.company),
        location: (cl.location as string | undefined) ?? params.conversion.location,
        channel: String(cl.channel ?? channel),
        responseTime: String(cl.responseTime ?? responseTime),
        multiplierNote: String(cl.multiplierNote ?? ""),
      },
      rationale: String(parsed.rationale ?? outreachPlaybook.rationale),
      searchQueries: sq,
      templates: playbookToTemplates(outreachPlaybook),
      pitchAngle: String(parsed.pitchAngle ?? outreachPlaybook.bestAngle),
      segmentTag: String(parsed.segmentTag ?? "segment"),
      insightsHeadline: String(parsed.insightsHeadline ?? ""),
      proactiveMessage: String(parsed.proactiveMessage ?? ""),
      similarExistingLeadsCount: resolvedLeads.length,
      similarExistingLeads: resolvedLeads,
      stats: { ...DEFAULT_STATS },
      platformQueries,
    }
  } catch {
    const dimensions = fallbackDimensionsFromConversion({
      name: params.conversion.name,
      title: params.conversion.title,
      company: params.conversion.company,
      location: params.conversion.location,
    })
    const outreachPlaybook = fallbackPlaybook({ channel, responseTime })
    const platformQueries = generatePlatformQueries(dimensions)
    const sq = platformQueriesToLegacySearch(dimensions, platformQueries)
    return {
      profileName: "Recovery profile",
      dimensions,
      outreachPlaybook,
      convertedLead: {
        name: params.conversion.name,
        roleTitle: params.conversion.title,
        company: params.conversion.company,
        location: params.conversion.location,
        channel,
        responseTime,
        multiplierNote: "Could not parse AI response — edit criteria and regenerate.",
      },
      rationale: outreachPlaybook.rationale,
      searchQueries: sq,
      templates: playbookToTemplates(outreachPlaybook),
      pitchAngle: "Manual review",
      segmentTag: "unknown",
      insightsHeadline: "Generation failed — try again with a shorter note or check API logs.",
      proactiveMessage: "—",
      similarExistingLeadsCount: 0,
      similarExistingLeads: [],
      stats: { ...DEFAULT_STATS },
      platformQueries,
    }
  }
}

export async function refineLookalikeProfileWithAI(params: {
  context: CompanyContext
  profileName: string
  dimensions: LookalikeDimensions
  outreachPlaybook: OutreachPlaybook
  stats: LookalikeStats
  outcomes: Array<{
    outcome: string
    actualAttributes: Record<string, string>
    channel: string | null
    notes: string | null
  }>
}): Promise<{ dimensions: LookalikeDimensions; outreachPlaybook: OutreachPlaybook; explanation: string }> {
  if (!hasAnthropicKey()) {
    return {
      dimensions: params.dimensions,
      outreachPlaybook: params.outreachPlaybook,
      explanation: "ANTHROPIC_API_KEY not set — skipped refinement.",
    }
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: appendWritingRules(`You refine a lookalike targeting profile from real outreach outcomes. Only change what the data supports; small samples (under 5 outcomes) — be conservative.

${params.context.promptBlock}

PROFILE NAME: ${params.profileName}

CURRENT DIMENSIONS (JSON):
${JSON.stringify(params.dimensions, null, 2)}

CURRENT OUTREACH PLAYBOOK (JSON):
${JSON.stringify(params.outreachPlaybook, null, 2)}

STATS:
${JSON.stringify(params.stats, null, 2)}

OUTREACH OUTCOMES (${params.outcomes.length}):
${params.outcomes
  .map(
    (o, i) =>
      `${i + 1}. outcome=${o.outcome} channel=${o.channel ?? "—"} attrs=${JSON.stringify(o.actualAttributes)} notes=${o.notes ?? "—"}`,
  )
  .join("\n")}

Return JSON ONLY:
{
  "dimensions": { ...full updated dimensions object, same schema as input },
  "outreachPlaybook": { ...full updated playbook, same schema as input },
  "explanation": "1-3 sentences on what changed and why"
}`),
      },
    ],
  })

  const text = extractText(response)
  try {
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}") as {
      dimensions?: unknown
      outreachPlaybook?: unknown
      explanation?: string
    }
    return {
      dimensions: normalizeDimensions(parsed.dimensions ?? params.dimensions),
      outreachPlaybook: normalizeOutreachPlaybook(parsed.outreachPlaybook ?? params.outreachPlaybook),
      explanation: String(parsed.explanation ?? "Profile updated."),
    }
  } catch {
    return {
      dimensions: params.dimensions,
      outreachPlaybook: params.outreachPlaybook,
      explanation: "Could not parse refinement response.",
    }
  }
}
