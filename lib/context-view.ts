/**
 * Shape for the dashboard Context page (company brain UI).
 * Maps to company_profile + optional onboarding extraction fallbacks.
 */

export type JackJillJobRow = {
  company: string
  title: string
  url?: string
  description?: string
}

export interface ContextData {
  knowledge: {
    markdown: string
    updatedAt: string | null
  }
  vault: {
    repo: string
    branch: string
    folders: string[]
    connected: boolean
    lastSyncedAt: string | null
    fileCount: number
    syncError: string | null
  }
  company: {
    name: string
    description: string
    problem: string
    solution: string
    market: string
    vertical: string
    stage: string
    business_model: string
    traction: string
  }
  founder: {
    name: string
    background: string
  }
  strategy: {
    thesis: string
    icp: string[]
    competitors: string[]
    differentiators: string
    priorities: string[]
    risks: string[]
    keywords: string[]
    /** Curated roles (e.g. Jack & Jill) — CRO scores these first */
    jack_jill_jobs: JackJillJobRow[]
  }
  meta: {
    lastUpdated: string
    onboardingDate: string
    completeness: number
    sources: string[]
  }
  /** From `competitor_tracking` — persistent Juno intelligence (read-only on this page). */
  competitor_tracking?: Array<{
    competitor_name: string
    event_type: string
    title: string
    threat_level: string | null
    discovered_at: string
  }>
}

export function emptyContextData(): ContextData {
  return {
    knowledge: {
      markdown: "",
      updatedAt: null,
    },
    vault: {
      repo: "",
      branch: "main",
      folders: [],
      connected: false,
      lastSyncedAt: null,
      fileCount: 0,
      syncError: null,
    },
    company: {
      name: "",
      description: "",
      problem: "",
      solution: "",
      market: "",
      vertical: "",
      stage: "",
      business_model: "",
      traction: "",
    },
    founder: {
      name: "",
      background: "",
    },
    strategy: {
      thesis: "",
      icp: [],
      competitors: [],
      differentiators: "",
      priorities: [],
      risks: [],
      keywords: [],
    },
    meta: {
      lastUpdated: "—",
      onboardingDate: "—",
      completeness: 0,
      sources: [],
    },
    competitor_tracking: [],
  }
}

export function parseStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val) as unknown
      if (Array.isArray(p)) return p.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    } catch {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

/** Payload for PUT /api/company/profile */
export function contextDataToProfilePayload(d: ContextData): Record<string, unknown> {
  return {
    company_name: d.company.name || null,
    company_description: d.company.description || null,
    tagline: d.company.description ? d.company.description.slice(0, 500) : null,
    problem: d.company.problem || null,
    solution: d.company.solution || null,
    target_market: d.company.market || null,
    vertical: d.company.vertical || null,
    industry: d.company.vertical || null,
    stage: d.company.stage || null,
    traction: d.company.traction || null,
    business_model: d.company.business_model || null,
    founder_name: d.founder.name || null,
    founder_background: d.founder.background || null,
    thesis: d.strategy.thesis || null,
    differentiators: d.strategy.differentiators || null,
    icp: d.strategy.icp,
    competitors: d.strategy.competitors,
    keywords: d.strategy.keywords,
    priorities: d.strategy.priorities,
    risks: d.strategy.risks,
    jack_jill_jobs: (d.strategy.jack_jill_jobs ?? []).filter(
      (r) => String(r.company ?? "").trim()
        && String(r.title ?? "").trim(),
    ),
  }
}

export function parseJackJillJobs(val: unknown): JackJillJobRow[] {
  if (!Array.isArray(val)) return []
  const out: JackJillJobRow[] = []
  for (const x of val) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue
    const r = x as Record<string, unknown>
    const company = String(r.company ?? "").trim()
    const title = String(r.title ?? "").trim()
    if (!company || !title) continue
    const url = typeof r.url === "string" ? r.url.trim() : ""
    const description = typeof r.description === "string" ? r.description.trim() : ""
    out.push({
      company,
      title,
      ...(url ? { url } : {}),
      ...(description ? { description } : {}),
    })
  }
  return out
}

export function calcCompleteness(d: ContextData): number {
  const fields = [
    d.knowledge.markdown,
    d.company.name,
    d.company.description,
    d.company.problem,
    d.company.solution,
    d.company.market,
    d.company.vertical,
    d.company.stage,
    d.company.traction,
    d.founder.name,
    d.founder.background,
    d.strategy.thesis,
    d.strategy.icp.length > 0 ? "yes" : "",
    d.strategy.competitors.length > 0 ? "yes" : "",
    d.strategy.differentiators,
    d.strategy.priorities.length > 0 ? "yes" : "",
    d.strategy.risks.length > 0 ? "yes" : "",
    d.strategy.keywords.length > 0 ? "yes" : "",
  ]
  const filled = fields.filter((f) => f && String(f).length > 0).length
  return Math.round((filled / fields.length) * 100)
}
