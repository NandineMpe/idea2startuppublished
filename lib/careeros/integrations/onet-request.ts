/**
 * O*NET Web Services — aligned with official v2 samples and migration guide:
 * - v2: https://api-v2.onetcenter.org/ + `X-API-Key` (see https://services.onetcenter.org/reference/start/overview#auth)
 * - v1.9 legacy: Basic auth to `services.onetcenter.org/ws/...` for accounts that still use username/password
 *
 * Keyword search (official migration doc):
 * - v2: GET `https://api-v2.onetcenter.org/mnm/search?keyword=...` + `X-API-Key`
 * - v1.9: GET `https://services.onetcenter.org/ws/mnm/search?keyword=...` + Basic auth
 */

const ONET_V2_DEFAULT_BASE = "https://api-v2.onetcenter.org"

/** Per O*NET ToS — identify the application on all requests. */
export const ONET_REQUEST_USER_AGENT = "CareerOS (contact: nano@augentik.com)"

export function onetV2BaseUrl(): string {
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
      "User-Agent": ONET_REQUEST_USER_AGENT,
    }
  }

  const u = process.env.ONET_USERNAME?.trim()
  const p = process.env.ONET_PASSWORD?.trim()
  if (u && p) {
    const token = Buffer.from(`${u}:${p}`).toString("base64")
    return {
      Authorization: `Basic ${token}`,
      Accept: "application/json",
      "User-Agent": ONET_REQUEST_USER_AGENT,
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

/** Keyword occupation search URL (v2 host when API key is configured). */
export function buildOnetKeywordSearchUrl(keyword: string, hasV2Key: boolean): string {
  const enc = encodeURIComponent(keyword)
  if (hasV2Key) {
    return `${onetV2BaseUrl()}/mnm/search?keyword=${enc}`
  }
  return `https://services.onetcenter.org/ws/mnm/search?keyword=${enc}`
}

/** Mask for diagnostics — first 2 + last 2 chars; never use for passwords in logs. */
export function maskOnetCredentialPreview(value: string | undefined): string {
  if (!value?.trim()) return "(unset)"
  const v = value.trim()
  if (v.length <= 4) return "••••"
  const mid = Math.min(8, Math.max(4, v.length - 4))
  return `${v.slice(0, 2)}${"•".repeat(mid)}${v.slice(-2)}`
}

/** Extract occupation/career rows from My Next Move keyword JSON (v2 or legacy). */
export function extractOccupationSearchArray(parsed: Record<string, unknown>): unknown[] {
  const list =
    parsed.career ??
    parsed.careers ??
    parsed.occupation ??
    parsed.occupations ??
    parsed.results ??
    (Array.isArray(parsed) ? parsed : undefined)
  return Array.isArray(list) ? list : []
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
  const url = buildOnetKeywordSearchUrl(keyword, hasV2Key)

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
    const list = extractOccupationSearchArray(parsed)
    occupationCount = list.length
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

export type OnetOccupationHit = {
  soc_code: string
  title?: string
}

function pickSocFromRow(row: Record<string, unknown>): string | null {
  const direct =
    row.code ??
    row.soc ??
    row.onet_soc_code ??
    row.soc_code ??
    row["onetsoc_code"] ??
    row["O*NET-SOC Code"]
  if (typeof direct === "string") {
    const m = direct.match(/\b\d{2}-\d{4}\.\d{2}\b/)
    if (m) return m[0]
  }
  const href = row.href ?? row.link ?? row.url
  if (typeof href === "string") {
    const m = href.match(/\b\d{2}-\d{4}\.\d{2}\b/)
    if (m) return m[0]
  }
  return null
}

/** Parse first occupation hit from keyword search JSON (v2 or legacy JSON shape). */
export function parseOccupationSearchHits(bodyText: string): OnetOccupationHit[] {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>
    const list = extractOccupationSearchArray(parsed)
    if (!list.length) return []
    const out: OnetOccupationHit[] = []
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const soc = pickSocFromRow(row)
      if (!soc) continue
      const title =
        typeof row.title === "string"
          ? row.title
          : typeof row.name === "string"
            ? row.name
            : typeof row.job_title === "string"
              ? row.job_title
              : undefined
      out.push({ soc_code: soc, title })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Keyword search → first O*NET-SOC code. Uses same routing rules as {@link probeOnetOccupationsKeyword}.
 */
export async function onetSearchFirstOccupation(
  keyword: string,
): Promise<{ hit: OnetOccupationHit | null; status: number; authMode?: "v2_api_key" | "v19_basic" }> {
  const apiKey = process.env.ONET_API_KEY?.trim()
  const headers = getOnetAuthHeaders()
  if (!headers) {
    return { hit: null, status: 0 }
  }
  const hasV2Key = Boolean(apiKey)
  const authMode = hasV2Key ? "v2_api_key" : "v19_basic"
  const url = buildOnetKeywordSearchUrl(keyword.trim(), hasV2Key)
  const response = await fetch(url, { headers })
  const text = await response.text()
  if (!response.ok) {
    return { hit: null, status: response.status, authMode }
  }
  const hits = parseOccupationSearchHits(text)
  return { hit: hits[0] ?? null, status: response.status, authMode }
}

/** Flatten hierarchical career skills payload (`/mnm/careers/{soc}/skills`). */
export function flattenOnetCareerSkillElements(payload: unknown): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = []
  const seen = new Set<string>()

  function walk(node: unknown): void {
    if (!node) return
    if (Array.isArray(node)) {
      for (const x of node) walk(x)
      return
    }
    if (typeof node !== "object") return
    const n = node as Record<string, unknown>
    if (typeof n.id === "string" && typeof n.name === "string") {
      if (!seen.has(n.id)) {
        seen.add(n.id)
        out.push({ id: n.id, name: n.name })
      }
    }
    if (Array.isArray(n.element)) walk(n.element)
  }

  walk(payload)
  return out
}

/**
 * Skills for an occupation (Content Model element IDs + labels).
 *
 * - With **`ONET_API_KEY`**: tries v2 first (`api-v2.onetcenter.org`), then legacy WS.
 * - **Without an API key** (username/password only): tries legacy **`services.onetcenter.org/ws/...`**
 *   first (same family as keyword search), then v2 as a last resort.
 */
export async function fetchOnetCareerSkillsFlat(socCode: string): Promise<{
  ok: boolean
  status: number
  skills: Array<{ id: string; name: string }>
}> {
  const headers = getOnetAuthHeaders()
  if (!headers) {
    return { ok: false, status: 0, skills: [] }
  }

  const socEnc = encodeURIComponent(socCode.trim())
  const hasV2Key = Boolean(process.env.ONET_API_KEY?.trim())
  const v2Url = `${onetV2BaseUrl()}/mnm/careers/${socEnc}/skills`
  const legacyUrl = `https://services.onetcenter.org/ws/mnm/careers/${socEnc}/skills`

  const urls = hasV2Key ? [v2Url, legacyUrl] : [legacyUrl, v2Url]

  let lastStatus = 0
  for (const url of urls) {
    const response = await fetch(url, { headers })
    lastStatus = response.status
    const text = await response.text()
    if (!response.ok) continue
    try {
      const parsed = JSON.parse(text) as unknown
      return {
        ok: true,
        status: response.status,
        skills: flattenOnetCareerSkillElements(parsed),
      }
    } catch {
      continue
    }
  }

  return { ok: false, status: lastStatus, skills: [] }
}
