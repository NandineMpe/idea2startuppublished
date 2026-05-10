type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
}

export async function pingLevelsFyi(): Promise<SourcePingResult> {
  const url = "https://www.levels.fyi/companies/google/salaries.md"
  const res = await fetch(url, {
    headers: { Accept: "text/markdown,text/plain;q=0.9,*/*;q=0.8" },
  })

  const text = await res.text()
  const sample = text.slice(0, 300)
  const looksLikeMarkdown = /(^#|\n#|\n- |\n\* )/.test(text) || text.includes("```")

  return {
    ok: res.ok && looksLikeMarkdown,
    status: res.status,
    sample,
    error: res.ok ? (looksLikeMarkdown ? undefined : "Response did not appear to be markdown.") : text.slice(0, 500),
  }
}
