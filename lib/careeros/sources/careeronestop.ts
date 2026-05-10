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

export async function pingCareerOneStop(): Promise<SourcePingResult> {
  const userId = requireEnv("CAREERONESTOP_USER_ID")
  const token = requireEnv("CAREERONESTOP_API_TOKEN")

  const keyword = encodeURIComponent("Software Developers")
  const location = encodeURIComponent("US")
  const url = `https://api.careeronestop.org/v1/occupation/${encodeURIComponent(userId)}/${keyword}/${location}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
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
