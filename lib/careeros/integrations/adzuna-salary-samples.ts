export type AdzunaSalarySamplesResult = {
  ok: boolean
  status: number
  salaries: number[]
  sampleSize: number
  error?: string
}

function env(name: string): string | null {
  const v = process.env[name]?.trim()
  return v || null
}

function extractSalaryNumbers(parsed: unknown): number[] {
  if (!parsed || typeof parsed !== "object") return []
  const root = parsed as Record<string, unknown>
  const results = Array.isArray(root.results) ? root.results : []
  const out: number[] = []
  for (const row of results) {
    if (!row || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    const vals = [r.salary_min, r.salary_max]
    for (const v of vals) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out.push(v)
    }
  }
  return out
}

export async function fetchAdzunaSalarySamples(params: {
  country: string
  keywords: string
  resultsPerPage?: number
}): Promise<AdzunaSalarySamplesResult> {
  const appId = env("ADZUNA_APP_ID")
  const appKey = env("ADZUNA_APP_KEY")
  if (!appId || !appKey) {
    return {
      ok: false,
      status: 0,
      salaries: [],
      sampleSize: 0,
      error: "missing_adzuna_credentials",
    }
  }

  const resultsPerPage = Math.max(5, Math.min(50, params.resultsPerPage ?? 25))
  const country = params.country.trim().toLowerCase()
  const url =
    `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&app_key=${encodeURIComponent(appKey)}` +
    `&results_per_page=${resultsPerPage}` +
    `&what=${encodeURIComponent(params.keywords)}`

  const res = await fetch(url, { headers: { Accept: "application/json" } })
  const text = await res.text()
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      salaries: [],
      sampleSize: 0,
      error: text.slice(0, 200),
    }
  }

  try {
    const parsed = JSON.parse(text) as unknown
    const salaries = extractSalaryNumbers(parsed)
    return {
      ok: true,
      status: res.status,
      salaries,
      sampleSize: salaries.length,
    }
  } catch {
    return {
      ok: false,
      status: res.status,
      salaries: [],
      sampleSize: 0,
      error: "invalid_json_response",
    }
  }
}
