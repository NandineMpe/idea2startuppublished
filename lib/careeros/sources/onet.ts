import {
  maskOnetCredentialPreview,
  onetV2BaseUrl,
  parseOccupationSearchHits,
} from "@/lib/careeros/integrations/onet-request"

type SourcePingResult = {
  ok: boolean
  status: number
  sample: unknown
  error?: string
  /** Set on Basic-auth failures only — masked, never raw credentials. */
  username_preview?: string
}

const ONET_USER_AGENT = "CareerOS (contact: nano@augentik.com)"

function requireTrimmedEnv(name: string): string | null {
  const v = process.env[name]
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

/**
 * O*NET connectivity check for the `_verify/sources` route.
 *
 * **Order:** HTTP Basic (`ONET_USERNAME` + `ONET_PASSWORD`, trimmed) → `GET /ws/about`
 * first, so behavior matches the diagnostic route and typical Vercel env. If those are
 * absent, falls back to **`ONET_API_KEY`** against v2 `mnm/search`.
 */
export async function pingONet(): Promise<SourcePingResult> {
  const username = requireTrimmedEnv("ONET_USERNAME")
  const password = requireTrimmedEnv("ONET_PASSWORD")

  if (username && password) {
    const auth = Buffer.from(`${username}:${password}`).toString("base64")
    const res = await fetch("https://services.onetcenter.org/ws/about", {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "User-Agent": ONET_USER_AGENT,
      },
    })

    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      /* O*NET sometimes returns XML if Accept is not honoured */
    }

    return {
      ok: res.ok,
      status: res.status,
      sample: res.ok ? parsed : null,
      error: res.ok ? undefined : text.slice(0, 500),
      username_preview: res.ok
        ? undefined
        : maskOnetCredentialPreview(process.env.ONET_USERNAME),
    }
  }

  const apiKey = process.env.ONET_API_KEY?.trim()
  if (apiKey) {
    const url = `${onetV2BaseUrl()}/mnm/search?keyword=${encodeURIComponent("software")}`
    const res = await fetch(url, {
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
        "User-Agent": ONET_USER_AGENT,
      },
    })
    const text = await res.text()
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        sample: null,
        error: text.slice(0, 500),
      }
    }
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      /* ignore */
    }
    const hits = parseOccupationSearchHits(text)
    return {
      ok: true,
      status: res.status,
      sample: {
        occupation_hits: hits.length,
        first_hit: hits[0] ?? null,
        response: parsed,
      },
    }
  }

  return {
    ok: false,
    status: 0,
    sample: {
      hint: "Set ONET_USERNAME + ONET_PASSWORD (Basic) or ONET_API_KEY (v2)",
    },
    error: "Missing O*NET credentials",
  }
}

/** Alias matching docs / Step 5 naming. */
export const pingOnet = pingONet
