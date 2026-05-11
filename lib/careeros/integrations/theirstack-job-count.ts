/**
 * TheirStack Job Search — free count mode (see vendor docs: include_total_results + blur_company_data).
 * Does not log raw bodies (Module 2.1 verification discipline).
 */

const THEIRSTACK_SEARCH_URL = "https://api.theirstack.com/v1/jobs/search"

export type TheirStackJobCountResult = {
  ok: boolean
  status: number
  totalResults?: number
  error?: string
}

function getTheirStackToken(): string | null {
  return process.env.THEIRSTACK_API_KEY?.trim() || null
}

/** Extract total from common response shapes without retaining raw payloads. */
function extractTotalResults(parsed: unknown): number | undefined {
  if (!parsed || typeof parsed !== "object") return undefined
  const o = parsed as Record<string, unknown>
  const candidates = [
    o.total_results,
    o.totalResults,
    o.total,
    (o.metadata as Record<string, unknown> | undefined)?.total_results,
    (o.metadata as Record<string, unknown> | undefined)?.total,
  ]
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return Math.round(c)
  }
  return undefined
}

export async function fetchTheirStackJobCount(params: {
  jobTitles: string[]
  postedMaxAgeDays: number
  countryCodes: string[]
}): Promise<TheirStackJobCountResult> {
  const token = getTheirStackToken()
  if (!token) {
    return { ok: false, status: 0, error: "missing_theirstack_api_key" }
  }

  const body: Record<string, unknown> = {
    include_total_results: true,
    blur_company_data: true,
    limit: 1,
    posted_at_max_age_days: Math.min(Math.max(1, params.postedMaxAgeDays), 730),
    job_title_or: params.jobTitles.slice(0, 20),
    job_country_code_or: params.countryCodes.map((c) => c.toUpperCase()),
  }

  const res = await fetch(THEIRSTACK_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "CareerOS-demand-engine/1.0",
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: text.slice(0, 200),
    }
  }

  try {
    const parsed = JSON.parse(text) as unknown
    return {
      ok: true,
      status: res.status,
      totalResults: extractTotalResults(parsed),
    }
  } catch {
    return { ok: false, status: res.status, error: "invalid_json_response" }
  }
}
