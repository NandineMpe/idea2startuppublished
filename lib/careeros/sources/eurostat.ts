type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
}

export async function pingEurostat(): Promise<SourcePingResult> {
  const url =
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?geo=IE&unit=PC_ACT&s_adj=SA"
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
