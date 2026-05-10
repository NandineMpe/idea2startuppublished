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

export async function pingONet(): Promise<SourcePingResult> {
  const username = requireEnv("ONET_USERNAME")
  const password = requireEnv("ONET_PASSWORD")
  const auth = Buffer.from(`${username}:${password}`).toString("base64")

  const res = await fetch("https://services.onetcenter.org/ws/about", {
    headers: {
      Authorization: `Basic ${auth}`,
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
