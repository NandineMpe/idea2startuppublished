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

export async function pingJSearch(): Promise<SourcePingResult> {
  const rapidApiKey = requireEnv("RAPIDAPI_KEY")
  const url =
    "https://jsearch.p.rapidapi.com/search?query=software%20engineer&page=1&num_pages=1"

  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": rapidApiKey,
      "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
      Accept: "application/json",
    },
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
