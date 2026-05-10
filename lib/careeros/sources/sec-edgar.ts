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

export async function pingSecEdgar(): Promise<SourcePingResult> {
  const userAgent = requireEnv("SEC_EDGAR_USER_AGENT")
  const res = await fetch("https://data.sec.gov/submissions/CIK0000320193.json", {
    headers: {
      "User-Agent": userAgent,
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
