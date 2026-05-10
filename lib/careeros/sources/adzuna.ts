type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export async function pingAdzuna(): Promise<SourcePingResult> {
  const appId = requireEnv("ADZUNA_APP_ID")
  const appKey = requireEnv("ADZUNA_APP_KEY")
  const url =
    `https://api.adzuna.com/v1/api/jobs/gb/search/1` +
    `?app_id=${encodeURIComponent(appId)}` +
    `&app_key=${encodeURIComponent(appKey)}` +
    `&results_per_page=1&what=software%20engineer`

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  })

  const text = await res.text()
  let sample: unknown = text.slice(0, 300)
  if (res.ok) {
    try {
      sample = JSON.parse(text)
    } catch {
      sample = text.slice(0, 300)
    }
  }

  return {
    ok: res.ok,
    status: res.status,
    sample,
    error: res.ok ? undefined : text.slice(0, 500),
  }
}
