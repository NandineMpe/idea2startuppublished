/**
 * TheirStack job search — returns employer + title + URL for evidence UI.
 * Paid credits apply per job row returned (keep limit low).
 */

const THEIRSTACK_SEARCH_URL = "https://api.theistack.com/v1/jobs/search"

export type TheirStackJobListing = {
  title: string
  company_name: string
  url: string
  posted_at: string | null
  location_label: string | null
}

export type TheirStackJobListingsResult = {
  ok: boolean
  listings: TheirStackJobListing[]
  total_results: number | null
  error?: string
  attribution: {
    vendor: "theirstack"
    queried_at: string
    posted_at_max_age_days: number
    job_title: string
    country_codes: string[]
  }
}

function getTheirStackToken(): string | null {
  return process.env.THEIRSTACK_API_KEY?.trim() || null
}

function safeText(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function pickJobUrl(r: Record<string, unknown>): string {
  const direct = [
    safeText(r.url),
    safeText(r.job_url),
    safeText(r.apply_url),
    safeText(r.application_url),
  ].find((s) => s.startsWith("http"))
  if (direct) return direct
  const links = r.links
  if (links && typeof links === "object") {
    const lo = links as Record<string, unknown>
    const nested = [safeText(lo.url), safeText(lo.apply_url)].find((s) => s.startsWith("http"))
    if (nested) return nested
  }
  return ""
}

function pickCompanyName(r: Record<string, unknown>): string {
  const company = r.company
  if (company && typeof company === "object") {
    const c = company as Record<string, unknown>
    const n = safeText(c.name || c.company_name)
    if (n) return n
  }
  return safeText(r.company_name || r.employer_name || r.employer) || "Employer not disclosed"
}

function pickLocation(r: Record<string, unknown>): string | null {
  const loc = safeText(r.location || r.job_location)
  if (loc) return loc
  const city = safeText(r.city)
  const country = safeText(r.country || r.country_code)
  if (city && country) return `${city}, ${country}`
  return city || country || null
}

function extractTotalResults(parsed: unknown): number | null {
  if (!parsed || typeof parsed !== "object") return null
  const o = parsed as Record<string, unknown>
  const candidates = [o.total_results, o.totalResults, o.total]
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return Math.round(c)
  }
  return null
}

export async function fetchTheirStackJobListings(params: {
  jobTitle: string
  postedMaxAgeDays: number
  countryCodes: string[]
  limit?: number
}): Promise<TheirStackJobListingsResult> {
  const queriedAt = new Date().toISOString()
  const attribution = {
    vendor: "theirstack" as const,
    queried_at: queriedAt,
    posted_at_max_age_days: params.postedMaxAgeDays,
    job_title: params.jobTitle,
    country_codes: params.countryCodes.map((c) => c.toUpperCase()),
  }

  const token = getTheirStackToken()
  if (!token) {
    return { ok: false, listings: [], total_results: null, error: "missing_theirstack_api_key", attribution }
  }

  const limit = Math.min(Math.max(1, params.limit ?? 5), 10)
  const body: Record<string, unknown> = {
    include_total_results: true,
    blur_company_data: false,
    limit,
    posted_at_max_age_days: Math.min(Math.max(1, params.postedMaxAgeDays), 90),
    job_title_or: [params.jobTitle],
    job_country_code_or: attribution.country_codes,
  }

  const res = await fetch(THEIRSTACK_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "CareerOS-market-intelligence/1.0",
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    return {
      ok: false,
      listings: [],
      total_results: null,
      error: text.slice(0, 200),
      attribution,
    }
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const rows = Array.isArray(parsed.data)
      ? parsed.data
      : Array.isArray(parsed.results)
        ? parsed.results
        : []

    const listings: TheirStackJobListing[] = []
    for (const row of rows) {
      if (!row || typeof row !== "object") continue
      const r = row as Record<string, unknown>
      const url = pickJobUrl(r)
      if (!url) continue
      listings.push({
        title: safeText(r.title || r.job_title) || params.jobTitle,
        company_name: pickCompanyName(r),
        url,
        posted_at: safeText(r.posted_at || r.date_posted) || null,
        location_label: pickLocation(r),
      })
    }

    return {
      ok: true,
      listings,
      total_results: extractTotalResults(parsed),
      attribution,
    }
  } catch {
    return {
      ok: false,
      listings: [],
      total_results: null,
      error: "invalid_json_response",
      attribution,
    }
  }
}
