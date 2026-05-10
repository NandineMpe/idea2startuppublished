type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
}

export async function pingCsoIreland(): Promise<SourcePingResult> {
  // HPM06 responds reliably on the public CSO PxStat endpoint.
  const url = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/HPM06/JSON-stat/2.0/en"
  const body = { query: [], response: { format: "json-stat2" } }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
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
