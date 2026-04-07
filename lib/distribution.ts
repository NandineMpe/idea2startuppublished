/**
 * Distribution / lookalike engine — client-side state + CSV import.
 * Persist via localStorage, scoped per signed-in user (see distributionStorageKey).
 */

import { buildApolloPeopleSearchUrl } from "@/lib/apollo-search-url"

/** @deprecated Old global key (shared across accounts on the same browser). Removed from reads; wiped on GTM load. */
export const DISTRIBUTION_STORAGE_KEY = "juno-distribution-v1"

export function distributionStorageKey(userId: string | null | undefined): string {
  const id = userId?.trim()
  return id ? `juno-distribution-v2:${id}` : "juno-distribution-v2:anon"
}

export type ConvertedLead = {
  name: string
  roleTitle: string
  company: string
  location?: string
  channel: string
  responseTime: string
  multiplierNote: string
}

export type LookalikeCriteria = {
  targetTitles: string[]
  companyTypes: string[]
  geography: string[]
  companySize: string[]
}

export type SearchQueries = {
  linkedinSalesNav: string
  apollo: string
  linkedinBoolean: string
  /** Pre-filled Apollo People search (hash URL). */
  apolloAppUrl?: string
}

export type OutreachTemplates = {
  inmail: string
  coldEmail: string
}

export type DistributionMatch = {
  id: string
  firstName: string
  lastName: string
  title: string
  company: string
  location: string
  fitScore: number
  sent: boolean
  /** Filled after POST /api/leads/import (distribution mode) */
  personalizedInmail?: string
  personalizedEmail?: string
}

export type ConversionHistoryEntry = {
  id: string
  segmentTag: string
  name: string
  company: string
  at: string
}

/** Rows from saved `lead_discovered` that match the current playbook (from analyse-conversion). */
export type SimilarSavedLead = {
  company: string
  role: string
  contactName?: string
}

/** Primary line for UI: contact name when present, else role/title. */
export function similarSavedLeadPrimaryLine(l: SimilarSavedLead): string {
  const n = l.contactName?.trim()
  if (n) return n
  return (l.role || l.company || "Lead").trim()
}

/** Secondary line: company context. */
export function similarSavedLeadSecondaryLine(l: SimilarSavedLead): string {
  if (l.contactName?.trim()) return [l.role, l.company].filter(Boolean).join(" · ")
  return l.company || ""
}

export type DistributionState = {
  activeLookalikeProfileId?: string | null
  convertedLead: ConvertedLead
  lookalike: LookalikeCriteria
  rationale: string
  searchQueries: SearchQueries
  templates: OutreachTemplates
  matches: DistributionMatch[]
  /** Winning angle — used when personalizing imported rows */
  pitchAngle: string
  segmentTag?: string
  /** Dashboard banner driven by Claude + conversion history */
  insightsHeadline: string
  proactiveMessage?: string
  similarLeadsCount?: number
  similarExistingLeads: SimilarSavedLead[]
  conversionHistory: ConversionHistoryEntry[]
}

/** Empty starter state — no sample names or ICP (avoid looking like another account's data). */
export const DEFAULT_DISTRIBUTION: DistributionState = {
  activeLookalikeProfileId: null,
  convertedLead: {
    name: "",
    roleTitle: "",
    company: "",
    location: "",
    channel: "",
    responseTime: "",
    multiplierNote: "",
  },
  lookalike: {
    targetTitles: [],
    companyTypes: [],
    geography: [],
    companySize: [],
  },
  rationale: "",
  searchQueries: {
    linkedinSalesNav: "",
    apollo: "",
    linkedinBoolean: "",
  },
  templates: {
    inmail: "",
    coldEmail: "",
  },
  matches: [],
  pitchAngle: "",
  insightsHeadline: "",
  similarExistingLeads: [],
  conversionHistory: [],
}

function buildQueriesFromCriteria(c: LookalikeCriteria): SearchQueries {
  const titles = c.targetTitles.slice(0, 4).join(" OR ")
  const industries = c.companyTypes.join(", ")
  const geo = c.geography.join(" OR ")
  const sizes = c.companySize.join(", ")

  const linkedinSalesNav = [
    `(${titles})`,
    `AND (${industries})`,
    `AND (${geo})`,
    `AND Company headcount: ${sizes}`,
  ].join(" ")

  const apollo = [
    `Titles: ${c.targetTitles.join(", ")}`,
    `Industry: ${c.companyTypes.join("; ")}`,
    `Location: ${c.geography.join(", ")}`,
    `Employee count: ${c.companySize.join(", ")}`,
  ].join(" | ")

  const linkedinBoolean = `(${c.targetTitles.map((t) => `"${t}"`).join(" OR ")}) AND (${c.geography.map((g) => `"${g}"`).join(" OR ")})`

  return { linkedinSalesNav, apollo, linkedinBoolean }
}

export function hydrateDistribution(partial: Partial<DistributionState> | null): DistributionState {
  const base = structuredClone(DEFAULT_DISTRIBUTION)
  if (!partial) {
    base.searchQueries = buildQueriesFromCriteria(base.lookalike)
    return base
  }
  const merged: DistributionState = {
    activeLookalikeProfileId:
      partial.activeLookalikeProfileId !== undefined
        ? partial.activeLookalikeProfileId
        : base.activeLookalikeProfileId,
    convertedLead: { ...base.convertedLead, ...partial.convertedLead },
    lookalike: {
      targetTitles: Array.isArray(partial.lookalike?.targetTitles)
        ? partial.lookalike!.targetTitles
        : base.lookalike.targetTitles,
      companyTypes: Array.isArray(partial.lookalike?.companyTypes)
        ? partial.lookalike!.companyTypes
        : base.lookalike.companyTypes,
      geography: Array.isArray(partial.lookalike?.geography)
        ? partial.lookalike!.geography
        : base.lookalike.geography,
      companySize: Array.isArray(partial.lookalike?.companySize)
        ? partial.lookalike!.companySize
        : base.lookalike.companySize,
    },
    rationale: partial.rationale ?? base.rationale,
    searchQueries: (() => {
      const lk = {
        targetTitles: partial.lookalike?.targetTitles ?? base.lookalike.targetTitles,
        companyTypes: partial.lookalike?.companyTypes ?? base.lookalike.companyTypes,
        geography: partial.lookalike?.geography ?? base.lookalike.geography,
        companySize: partial.lookalike?.companySize ?? base.lookalike.companySize,
      }
      const sq = partial.searchQueries?.linkedinSalesNav
        ? { ...partial.searchQueries }
        : buildQueriesFromCriteria(lk)
      if (!sq.apolloAppUrl?.trim()) {
        sq.apolloAppUrl = buildApolloPeopleSearchUrl(lk)
      }
      return sq
    })(),
    templates: { ...base.templates, ...partial.templates },
    matches: Array.isArray(partial.matches)
      ? partial.matches.map((m) => ({
          ...m,
          sent: Boolean((m as DistributionMatch).sent),
        }))
      : [],
    pitchAngle: partial.pitchAngle ?? base.pitchAngle,
    segmentTag: partial.segmentTag ?? base.segmentTag,
    insightsHeadline: partial.insightsHeadline ?? base.insightsHeadline,
    proactiveMessage: partial.proactiveMessage ?? base.proactiveMessage,
    similarLeadsCount: partial.similarLeadsCount ?? base.similarLeadsCount,
    similarExistingLeads: Array.isArray(partial.similarExistingLeads)
      ? partial.similarExistingLeads.map((r) => ({
          company: String((r as SimilarSavedLead).company ?? ""),
          role: String((r as SimilarSavedLead).role ?? ""),
          contactName:
            typeof (r as SimilarSavedLead).contactName === "string"
              ? (r as SimilarSavedLead).contactName
              : undefined,
        }))
      : base.similarExistingLeads,
    conversionHistory: Array.isArray(partial.conversionHistory)
      ? partial.conversionHistory
      : base.conversionHistory,
  }
  return merged
}

export function loadDistributionState(userId?: string | null): DistributionState {
  if (typeof window === "undefined") return structuredClone(DEFAULT_DISTRIBUTION)
  try {
    try {
      localStorage.removeItem(DISTRIBUTION_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    const key = distributionStorageKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) {
      const fresh = hydrateDistribution(null)
      localStorage.setItem(key, JSON.stringify(fresh))
      return fresh
    }
    const parsed = JSON.parse(raw) as Partial<DistributionState>
    return hydrateDistribution(parsed)
  } catch {
    return hydrateDistribution(null)
  }
}

export function saveDistributionState(state: DistributionState, userId?: string | null) {
  if (typeof window === "undefined") return
  localStorage.setItem(distributionStorageKey(userId), JSON.stringify(state))
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    const next = line[i + 1]
    if (c === '"' && inQuotes && next === '"') {
      cur += '"'
      i++
      continue
    }
    if (c === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (c === "," && !inQuotes) {
      out.push(cur.trim())
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur.trim())
  return out
}

/** Parses CSV text into rows (handles quoted fields). */
export function parseCsvRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  return lines.map(parseCsvLine)
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function findCol(header: string[], ...candidates: string[]): number {
  const h = header.map(norm)
  for (const cand of candidates) {
    const n = norm(cand)
    const i = h.findIndex((cell) => cell.includes(n) || n.includes(cell))
    if (i >= 0) return i
  }
  return -1
}

function hashScore(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  return 55 + (Math.abs(h) % 45)
}

export function csvToMatches(rows: string[][]): DistributionMatch[] {
  if (rows.length < 2) return []
  const header = rows[0]
  const iFirst = findCol(header, "first name", "firstname", "first")
  const iLast = findCol(header, "last name", "lastname", "last")
  const iTitle = findCol(header, "title", "job title", "position")
  const iCompany = findCol(header, "company", "organization", "account name")
  const iLoc = findCol(header, "location", "geography", "country")

  const out: DistributionMatch[] = []
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]
    if (line.length < 2) continue
    const firstName = iFirst >= 0 ? line[iFirst] || "" : line[0] || ""
    const lastName = iLast >= 0 ? line[iLast] || "" : line[1] || ""
    const title = iTitle >= 0 ? line[iTitle] || "" : line[2] || "—"
    const company = iCompany >= 0 ? line[iCompany] || "" : line[3] || "—"
    const location = iLoc >= 0 ? line[iLoc] || "" : line[4] || ""
    const nameKey = `${firstName}|${lastName}|${company}`.trim()
    if (!nameKey.replace(/\|/g, "")) continue
    const id = `m-${r}-${hashScore(nameKey)}`
    out.push({
      id,
      firstName,
      lastName,
      title,
      company,
      location,
      fitScore: hashScore(nameKey),
      sent: false,
    })
  }
  return out
}

export type TemplateVars = {
  name: string
  firstName: string
  title: string
  company: string
  location: string
  sender_name: string
}

export function fillTemplate(template: string, vars: TemplateVars): string {
  let s = template
  const fullName = [vars.firstName, vars.lastName].filter(Boolean).join(" ").trim() || vars.name
  const map: Record<string, string> = {
    name: fullName,
    firstName: vars.firstName,
    title: vars.title,
    /** Same as title — Sales Nav / Apollo style */
    function: vars.title,
    company: vars.company,
    location: vars.location || "your region",
    sender_name: vars.sender_name || "Your name",
  }
  for (const [k, v] of Object.entries(map)) {
    s = s.replaceAll(`{${k}}`, v)
  }
  return s
}

export type DistributionImportJobRow = {
  company: string
  role: string
  firstName: string
  lastName: string
  location: string
}

/** Rows for POST /api/leads/import with distribution: true */
export function matchesToDistributionJobs(matches: DistributionMatch[]): DistributionImportJobRow[] {
  return matches.map((m) => ({
    company: m.company,
    role: m.title,
    firstName: m.firstName,
    lastName: m.lastName,
    location: m.location,
  }))
}

const CHUNK = 8

export async function personalizeMatchesViaApi(
  matches: DistributionMatch[],
  conversionProfile: {
    rationale: string
    multiplierNote: string
    pitchAngle: string
    templates: OutreachTemplates
    lookalikeProfileId?: string | null
  },
): Promise<DistributionMatch[]> {
  const jobs = matchesToDistributionJobs(matches)
  if (jobs.length === 0) return matches

  const byKey = new Map<string, DistributionMatch>()
  for (const m of matches) {
    byKey.set(matchMergeKey(m), m)
  }

  const out = new Map<string, DistributionMatch>()
  for (const m of matches) out.set(m.id, { ...m })

  for (let i = 0; i < jobs.length; i += CHUNK) {
    const chunk = jobs.slice(i, i + CHUNK)
    const res = await fetch("/api/leads/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
        body: JSON.stringify({
        source: "distribution",
        distribution: true,
        lookalikeProfileId: conversionProfile.lookalikeProfileId ?? undefined,
        conversionProfile: {
          rationale: conversionProfile.rationale,
          multiplierNote: conversionProfile.multiplierNote,
          pitchAngle: conversionProfile.pitchAngle,
          templates: conversionProfile.templates,
        },
        jobs: chunk,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(typeof err.error === "string" ? err.error : `Import failed (${res.status})`)
    }
    const data = (await res.json()) as {
      results?: Array<{
        company: string
        role: string
        firstName: string
        lastName: string
        location: string
        fitScore: number
        personalizedInmail: string
        personalizedEmail: string
      }>
    }
    for (const r of data.results ?? []) {
      const key = `${r.company.toLowerCase().trim()}|${r.role.toLowerCase().trim()}|${r.firstName.toLowerCase()}|${r.lastName.toLowerCase()}`
      const m = byKey.get(key)
      if (!m) continue
      const cur = out.get(m.id)
      if (!cur) continue
      out.set(m.id, {
        ...cur,
        fitScore: r.fitScore,
        personalizedInmail: r.personalizedInmail,
        personalizedEmail: r.personalizedEmail,
      })
    }
  }

  return matches.map((m) => out.get(m.id) ?? m)
}

function matchMergeKey(m: DistributionMatch): string {
  return `${m.company.toLowerCase().trim()}|${m.title.toLowerCase().trim()}|${m.firstName.toLowerCase().trim()}|${m.lastName.toLowerCase().trim()}`
}

/** Client-side rollup when multiple conversions are logged (complements API insightsHeadline). */
export function summarizeConversionHistory(history: ConversionHistoryEntry[]): string {
  if (history.length === 0) return ""
  const bySeg = new Map<string, number>()
  for (const h of history) {
    const tag = h.segmentTag || "unknown"
    bySeg.set(tag, (bySeg.get(tag) ?? 0) + 1)
  }
  const sorted = [...bySeg.entries()].sort((a, b) => b[1] - a[1])
  const [top, n] = sorted[0] ?? ["", 0]
  if (!top || top === "unknown") {
    return `${history.length} conversion(s) logged — generate another lookalike to sharpen segment insights.`
  }
  const pct = Math.round((n / history.length) * 100)
  const label = top.replace(/_/g, " ")
  return `${n} of ${history.length} conversions were ${label} — ${pct}% hit rate on this profile.`
}
