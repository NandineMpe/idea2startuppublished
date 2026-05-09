/**
 * O*NET Web Services — aligned with official v2 samples and migration guide:
 * - v2: https://api-v2.onetcenter.org/ + `X-API-Key` (see https://services.onetcenter.org/reference/start/overview#auth)
 * - v1.9 legacy: Basic auth to `services.onetcenter.org/ws/...` for accounts that still use username/password
 *
 * Keyword search (v2): GET `online/search?keyword=...` (official node sample: web-services-v2-samples)
 */

const ONET_V2_DEFAULT_BASE = "https://api-v2.onetcenter.org"

function onetV2BaseUrl(): string {
  const raw = process.env.ONET_API_BASE_URL?.trim()
  if (raw) return raw.replace(/\/$/, "")
  return ONET_V2_DEFAULT_BASE
}

export type OnetKeywordProbeResult = {
  ok: boolean
  status: number
  occupationCount?: number
  skippedReason?: "missing_credentials"
  authMode?: "v2_api_key" | "v19_basic"
}

/** Headers for O*NET HTTP requests (v2 API key preferred). */
export function getOnetAuthHeaders(): Record<string, string> | null {
  const apiKey = process.env.ONET_API_KEY?.trim()
  if (apiKey) {
    return {
      "X-API-Key": apiKey,
      Accept: "application/json",
      "User-Agent": "Juno-CareerOS/1.0 (onet probe)",
    }
  }

  const u = process.env.ONET_USERNAME?.trim()
  const p = process.env.ONET_PASSWORD?.trim()
  if (u && p) {
    const token = Buffer.from(`${u}:${p}`).toString("base64")
    return {
      Authorization: `Basic ${token}`,
      Accept: "application/json",
    }
  }

  return null
}

/**
 * @deprecated Use getOnetAuthHeaders(). Kept for callers that only need Basic legacy auth string.
 */
export function getOnetAuthorizationHeader(): string | null {
  const h = getOnetAuthHeaders()
  if (!h) return null
  return h.Authorization ?? null
}

function onetKeywordSearchUrl(keyword: string, hasV2Key: boolean): string {
  const enc = encodeURIComponent(keyword)
  if (hasV2Key) {
    return `${onetV2BaseUrl()}/online/search?keyword=${enc}`
  }
  return `https://services.onetcenter.org/ws/online/occupations?keyword=${enc}`
}

/**
 * Lightweight probe used by cache refresh jobs — does not persist to Postgres yet.
 */
export async function probeOnetOccupationsKeyword(
  keyword: string,
): Promise<OnetKeywordProbeResult> {
  const apiKey = process.env.ONET_API_KEY?.trim()
  const headers = getOnetAuthHeaders()
  if (!headers) {
    return { ok: false, status: 0, skippedReason: "missing_credentials" }
  }

  const hasV2Key = Boolean(apiKey)
  const authMode = hasV2Key ? "v2_api_key" : "v19_basic"
  const url = onetKeywordSearchUrl(keyword, hasV2Key)

  const response = await fetch(url, {
    headers,
  })

  if (!response.ok) {
    return { ok: false, status: response.status, authMode }
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
    authMode,
  }
}
