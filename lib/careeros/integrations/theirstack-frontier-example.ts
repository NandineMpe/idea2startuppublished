/**
 * One TheirStack job row for frontier credibility links (paid credits: 1 per job returned).
 * Does not log raw bodies (match Module 2.1 discipline: extract only title + URL).
 */

const THEIRSTACK_SEARCH_URL = "https://api.theirstack.com/v1/jobs/search"

function getTheirStackToken(): string | null {
  return process.env.THEIRSTACK_API_KEY?.trim() || null
}

function safeText(v: unknown): string {
  return typeof v === "string" ? v : ""
}

function pickJobUrl(r: Record<string, unknown>): string {
  const direct = [
    safeText(r.url),
    safeText(r.job_url),
    safeText(r.apply_url),
    safeText(r.application_url),
    safeText(r.redirect_url),
  ].find((s) => s.startsWith("http"))
  if (direct) return direct
  const links = r.links
  if (links && typeof links === "object") {
    const lo = links as Record<string, unknown>
    const nested = [safeText(lo.url), safeText(lo.apply), safeText(lo.apply_url)].find((s) =>
      s.startsWith("http"),
    )
    if (nested) return nested
  }
  return ""
}

export async function fetchTheirStackFrontierExample(params: {
  jobTitle: string
  postedMaxAgeDays: number
  countryCodes: string[]
}): Promise<{ ok: boolean; title?: string; url?: string; error?: string }> {
  const token = getTheirStackToken()
  if (!token) {
    return { ok: false, error: "missing_theirstack_api_key" }
  }

  const body: Record<string, unknown> = {
    blur_company_data: false,
    limit: 1,
    posted_at_max_age_days: Math.min(Math.max(1, params.postedMaxAgeDays), 730),
    job_title_or: [params.jobTitle],
    job_country_code_or: params.countryCodes.map((c) => c.toUpperCase()),
  }

  const res = await fetch(THEIRSTACK_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "CareerOS-frontier-roles/1.0",
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    return { ok: false, error: text.slice(0, 200) }
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const rows = Array.isArray(parsed.data)
      ? parsed.data
      : Array.isArray(parsed.results)
        ? parsed.results
        : []
    const first = rows[0]
    if (!first || typeof first !== "object") {
      return { ok: true, title: undefined, url: undefined }
    }
    const row = first as Record<string, unknown>
    const title = safeText(row.title || row.job_title) || params.jobTitle
    const url = pickJobUrl(row)
    return { ok: true, title: title || undefined, url: url || undefined }
  } catch {
    return { ok: false, error: "invalid_json_response" }
  }
}
