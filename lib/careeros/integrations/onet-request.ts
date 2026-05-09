/**
 * Minimal O*NET Web Services calls for workers (Inngest). Uses env auth only — no client secrets in logs.
 */

export type OnetKeywordProbeResult = {
  ok: boolean
  status: number
  occupationCount?: number
  skippedReason?: "missing_credentials"
}

export function getOnetAuthorizationHeader(): string | null {
  const hasPair =
    process.env.ONET_USERNAME &&
    process.env.ONET_PASSWORD &&
    process.env.ONET_USERNAME.length > 0 &&
    process.env.ONET_PASSWORD.length > 0

  if (hasPair) {
    const token = Buffer.from(
      `${process.env.ONET_USERNAME}:${process.env.ONET_PASSWORD}`,
    ).toString("base64")
    return `Basic ${token}`
  }

  if (process.env.ONET_API_KEY && process.env.ONET_API_KEY.length > 0) {
    const token = Buffer.from(`${process.env.ONET_API_KEY}:`).toString("base64")
    return `Basic ${token}`
  }

  return null
}

/**
 * Lightweight probe used by cache refresh jobs — does not persist to Postgres yet.
 */
export async function probeOnetOccupationsKeyword(
  keyword: string,
): Promise<OnetKeywordProbeResult> {
  const auth = getOnetAuthorizationHeader()
  if (!auth) {
    return { ok: false, status: 0, skippedReason: "missing_credentials" }
  }

  const url = `https://services.onetcenter.org/ws/online/occupations?keyword=${encodeURIComponent(keyword)}`

  const response = await fetch(url, {
    headers: {
      Authorization: auth,
      Accept: "application/json",
    },
  })

  if (!response.ok) {
    return { ok: false, status: response.status }
  }

  const text = await response.text()
  let occupationCount: number | undefined

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const list =
      parsed.occupation ??
      parsed.occupations ??
      parsed.results ??
      (Array.isArray(parsed) ? parsed : undefined)
    if (Array.isArray(list)) {
      occupationCount = list.length
    }
  } catch {
    const matches = text.match(/<occupation\b/gi)
    occupationCount = matches?.length
  }

  return {
    ok: true,
    status: response.status,
    occupationCount,
  }
}
