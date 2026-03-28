/**
 * TheOrg API — org chart + position enrichment.
 * Docs: https://developers.theorg.com/api (auth: X-Api-Key)
 */

const THEORG_BASE = "https://api.theorg.com"

export type OrgPerson = {
  name: string
  title: string
  department: string | null
  reportsTo: string | null
  linkedinUrl: string | null
  email: string | null
  positionId: string
  chartNodeId: string
}

export type OrgChartResult = {
  companyName: string
  companyDomain: string
  people: OrgPerson[]
  relevantContacts: OrgPerson[]
  orgStructure: string
}

type ChartNode = {
  id: string
  nodeType?: string
  fullName?: string
  title?: string
  jobTitle?: string
  managerId?: string | null
  positionId?: number | string
}

function theorgHeaders(): HeadersInit {
  const key = process.env.THEORG_API_KEY?.trim()
  if (!key) return {}
  return {
    Accept: "application/json",
    "X-Api-Key": key,
  }
}

function findManagerName(nodes: ChartNode[], managerId: string | null | undefined): string | null {
  if (!managerId) return null
  const m = nodes.find((n) => n.id === managerId)
  if (m?.fullName) return m.fullName
  if (m?.nodeType === "coManager" && (m as { name?: string }).name) {
    return (m as { name: string }).name
  }
  return null
}

function parseChartNodes(raw: unknown): ChartNode[] {
  if (!raw || typeof raw !== "object") return []
  const d = (raw as { data?: unknown }).data
  if (Array.isArray(d)) return d as ChartNode[]
  return []
}

export function guessDomainFromCompanyName(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/(inc|llc|ltd|plc|corp|corporation)$/i, "")
  return `${cleaned || "company"}.com`
}

export function extractDomainFromUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) return null
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    const h = u.hostname.replace(/^www\./, "")
    return h || null
  } catch {
    return null
  }
}

/** Placeholder when TheOrg has no work email — founder sends from their own client. */
export const MANUAL_OUTREACH_EMAIL_PLACEHOLDER = "pending@manual-send.local"

export function isManualOutreachEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase() ?? ""
  return e === MANUAL_OUTREACH_EMAIL_PLACEHOLDER.toLowerCase() || e.endsWith("@manual-send.local")
}

function isThirdPartyJobBoardHost(host: string): boolean {
  const h = host.toLowerCase()
  const boards = [
    "jackandjill.ai",
    "greenhouse.io",
    "boards.greenhouse.io",
    "lever.co",
    "jobs.lever.co",
    "ashbyhq.com",
    "jobs.ashbyhq.com",
    "myworkdayjobs.com",
    "wd5.myworkdayjobs.com",
    "smartrecruiters.com",
    "taleo.net",
    "oraclecloud.com",
    "ultipro.com",
    "icims.com",
    "jobvite.com",
    "breezy.hr",
    "applytojob.com",
    "recruitee.com",
    "teamtailor.com",
    "linkedin.com",
    "indeed.com",
    "glassdoor.com",
    "ziprecruiter.com",
    "monster.com",
  ]
  if (boards.some((b) => h === b || h.endsWith(`.${b}`))) return true
  return false
}

/**
 * Domain hint for TheOrg org-chart lookup. Returns `null` when the job URL is a third-party board
 * (including Jack & Jill) so we fall back to {@link guessDomainFromCompanyName} instead of
 * using the board’s hostname (e.g. jackandjill.ai).
 */
export function resolveDomainForTheOrgLookup(
  companyName: string,
  jobUrl: string | undefined | null,
  source?: string | null,
): string | null {
  const src = source?.toLowerCase() ?? ""
  if (src === "jack_and_jill" || src === "jackandjill") {
    return null
  }
  const host = extractDomainFromUrl(jobUrl)
  if (!host) return null
  if (isThirdPartyJobBoardHost(host)) {
    return null
  }
  return host
}

function buildOrgSummary(contacts: OrgPerson[]): string {
  return contacts
    .map(
      (c) =>
        `${c.name} — ${c.title}${c.reportsTo ? ` (reports to ${c.reportsTo})` : ""}`,
    )
    .join("\n")
}

function isPositionNode(n: ChartNode): boolean {
  return n.nodeType === "position" && Boolean(n.fullName)
}

function filterRelevantPeople(
  people: OrgPerson[],
  targetFunctions: string[],
): OrgPerson[] {
  const lowerTargets = targetFunctions.map((f) => f.toLowerCase())
  return people.filter((p) => {
    const titleLower = p.title.toLowerCase()
    return (
      lowerTargets.some((t) => titleLower.includes(t)) ||
      titleLower.includes("chief") ||
      /\bcto\b|\bcio\b|\bcdo\b|\bciso\b|\bcpo\b|\bvp\b|\bdirector\b|\bpartner\b|\bhead\b/i.test(
        titleLower,
      )
    )
  })
}

/**
 * Fetch org chart by domain (TheOrg v1.2).
 */
export async function lookupOrgChart(
  companyName: string,
  companyDomain: string | null,
  targetFunctions: string[],
): Promise<OrgChartResult | null> {
  const apiKey = process.env.THEORG_API_KEY?.trim()
  if (!apiKey) return null

  const domain = companyDomain?.trim() || guessDomainFromCompanyName(companyName)

  try {
    const url = new URL(`${THEORG_BASE}/v1.2/companies/org-chart`)
    url.searchParams.set("domain", domain)
    url.searchParams.set("section", "orgChart")

    const companyRes = await fetch(url.toString(), {
      headers: theorgHeaders(),
      signal: AbortSignal.timeout(15000),
    })

    if (!companyRes.ok) {
      console.warn(`[TheOrg] org-chart failed: ${domain} (${companyRes.status})`)
      return null
    }

    const json = (await companyRes.json()) as { data?: unknown }
    const nodes = parseChartNodes(json)

    const people: OrgPerson[] = []
    for (const node of nodes) {
      if (!isPositionNode(node)) continue
      const pid =
        node.positionId !== undefined && node.positionId !== null
          ? String(node.positionId)
          : node.id
      people.push({
        name: node.fullName || "Unknown",
        title: node.title || node.jobTitle || "",
        department: null,
        reportsTo: findManagerName(nodes, node.managerId ?? null),
        linkedinUrl: null,
        email: null,
        positionId: pid,
        chartNodeId: node.id,
      })
    }

    const relevantContacts = filterRelevantPeople(people, targetFunctions)
    const orgStructure = buildOrgSummary(relevantContacts.length > 0 ? relevantContacts : people.slice(0, 25))

    return {
      companyName,
      companyDomain: domain,
      people,
      relevantContacts,
      orgStructure,
    }
  } catch (e) {
    console.error("[TheOrg] lookupOrgChart:", e)
    return null
  }
}

/**
 * Enrich a chart node with email / LinkedIn via POST /v1.1/positions (company filter + name).
 */
export async function getContactDetails(
  chartNodeId: string,
  companyDomain: string,
  fullName: string,
): Promise<{ email: string | null; linkedin: string | null }> {
  const apiKey = process.env.THEORG_API_KEY?.trim()
  if (!apiKey) return { email: null, linkedin: null }

  try {
    const body = {
      limit: 3,
      offset: 0,
      filters: {
        companyDomains: [companyDomain],
        personFullNames: [fullName],
      },
    }

    const res = await fetch(`${THEORG_BASE}/v1.1/positions`, {
      method: "POST",
      headers: {
        ...theorgHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) return { email: null, linkedin: null }

    const json = (await res.json()) as {
      data?: { items?: Array<{ workEmail?: string | null; linkedInUrl?: string | null }> }
    }
    const first = json.data?.items?.[0]
    return {
      email: first?.workEmail ?? null,
      linkedin: first?.linkedInUrl ?? null,
    }
  } catch {
    return { email: null, linkedin: null }
  }
}
