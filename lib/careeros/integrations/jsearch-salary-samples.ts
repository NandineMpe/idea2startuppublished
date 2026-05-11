export type JSearchSalarySamplesResult = {
  ok: boolean
  status: number
  salaries: number[]
  sampleSize: number
  error?: string
}

function key(): string | null {
  return (
    process.env.JSEARCH_API_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim() ||
    null
  )
}

function pickAnnualSalaryValues(row: Record<string, unknown>): number[] {
  const vals = [
    row.job_min_salary,
    row.job_max_salary,
    row.salary_min,
    row.salary_max,
    row.min_salary,
    row.max_salary,
  ]
  const out: number[] = []
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out.push(v)
  }
  return out
}

export async function fetchJSearchSalarySamples(params: {
  query: string
  location: string
}): Promise<JSearchSalarySamplesResult> {
  const apiKey = key()
  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      salaries: [],
      sampleSize: 0,
      error: "missing_jsearch_api_key",
    }
  }

  const url =
    `https://jsearch.p.rapidapi.com/search` +
    `?query=${encodeURIComponent(params.query)}` +
    `&page=1` +
    `&num_pages=1` +
    `&location=${encodeURIComponent(params.location)}`

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      Accept: "application/json",
    },
  })

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
    const parsed = JSON.parse(text) as Record<string, unknown>
    const data = Array.isArray(parsed.data) ? parsed.data : []
    const salaries: number[] = []
    for (const row of data) {
      if (!row || typeof row !== "object") continue
      salaries.push(...pickAnnualSalaryValues(row as Record<string, unknown>))
    }
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
