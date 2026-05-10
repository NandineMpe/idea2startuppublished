type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
}

export async function pingArxiv(): Promise<SourcePingResult> {
  const url = "http://export.arxiv.org/api/query?search_query=cat:cs.AI&max_results=1"
  const res = await fetch(url, {
    headers: { Accept: "application/atom+xml,text/xml;q=0.9,*/*;q=0.8" },
  })

  const text = await res.text()
  const sample = text.slice(0, 300)

  return {
    ok: res.ok && text.includes("<feed"),
    status: res.status,
    sample,
    error: res.ok ? (text.includes("<feed") ? undefined : "Unexpected arXiv response format.") : text.slice(0, 500),
  }
}
