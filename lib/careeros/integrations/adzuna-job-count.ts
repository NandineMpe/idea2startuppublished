/**
 * Adzuna search — uses API `count` field (total matches) without pagination quota burn.
 * Semantics: total active listings matching query at query time (see docs).
 */

export type AdzunaJobCountResult = {
  ok: boolean
  status: number
  count?: number
  error?: string
}

function requireEnv(name: string): string | undefined {
  return process.env[name]?.trim()
}

export async function fetchAdzunaTotalCount(params: {
  country: string
  keywords: string
}): Promise<AdzunaJobCountResult> {
  const appId = requireEnv("ADZUNA_APP_ID")
  const appKey = requireEnv("ADZUNA_APP_KEY")
  if (!appId || !appKey) {
    return { ok: false, status: 0, error: "missing_adzuna_credentials" }
  }

  const country = params.country.trim().toLowerCase()
  const url =
    `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/1` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&app_key=${encodeURIComponent(appKey)}` +
    `&results_per_page=1` +
    `&what=${encodeURIComponent(params.keywords)}`

  const res = await fetch(url, { headers: { Accept: "application/json" } })
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, error: text.slice(0, 200) }
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const count =
      typeof parsed.count === "number"
        ? parsed.count
        : typeof parsed.total === "number"
          ? parsed.total
          : undefined
    return { ok: true, status: res.status, count }
  } catch {
    return { ok: false, status: res.status, error: "invalid_json_response" }
  }
}
