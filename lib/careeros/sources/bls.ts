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

export async function pingBls(): Promise<SourcePingResult> {
  const apiKey = requireEnv("BLS_API_KEY")

  const res = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      seriesid: ["OEU0000000000000151252000"],
      registrationkey: apiKey,
    }),
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
