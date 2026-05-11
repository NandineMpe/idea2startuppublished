/**
 * JSearch (RapidAPI) — uses aggregate total when present for sanity-check vs TheirStack/Adzuna.
 */

export type JSearchJobCountResult = {
  ok: boolean
  status: number
  totalJobs?: number
  error?: string
}

function rapidApiKey(): string | null {
  return (
    process.env.JSEARCH_API_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim() ||
    null
  )
}

export async function fetchJSearchTotalJobs(params: {
  query: string
  location: string
}): Promise<JSearchJobCountResult> {
  const key = rapidApiKey()
  if (!key) {
    return { ok: false, status: 0, error: "missing_jsearch_api_key" }
  }

  const url =
    `https://jsearch.p.rapidapi.com/search` +
    `?query=${encodeURIComponent(params.query)}` +
    `&page=1` +
    `&num_pages=1` +
    `&location=${encodeURIComponent(params.location)}`

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      Accept: "application/json",
    },
  })

  const text = await res.text()
  if (!res.ok) {
    return { ok: false, status: res.status, error: text.slice(0, 200) }
  }

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const total =
      typeof parsed.total_jobs === "number"
        ? parsed.total_jobs
        : typeof parsed.total === "number"
          ? parsed.total
          : undefined
    return { ok: true, status: res.status, totalJobs: total }
  } catch {
    return { ok: false, status: res.status, error: "invalid_json_response" }
  }
}
