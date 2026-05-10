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
}

const ONET_USER_AGENT = "CareerOS (contact: nano@augentik.com)"

/**
 * O*NET connectivity check.
 * - **`ONET_API_KEY`**: v2 `GET …/mnm/search` with `X-API-Key`, `Accept`, `User-Agent`.
 * - **Basic**: trimmed `ONET_USERNAME` / `ONET_PASSWORD` → `GET …/ws/about` (legacy Web Services).
 */
export async function pingONet(): Promise<SourcePingResult> {
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
        sample: {
          url,
          auth_mode: "v2_api_key",
          response_preview: text.slice(0, 400),
        },
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

  const rawU = process.env.ONET_USERNAME
  const rawP = process.env.ONET_PASSWORD
  const username = rawU?.trim()
  const password = rawP?.trim()
  if (!username || !password) {
    return {
      ok: false,
      status: 0,
      sample: { hint: "Set ONET_API_KEY (v2) or ONET_USERNAME + ONET_PASSWORD" },
      error: "Missing O*NET credentials",
    }
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64")
  const aboutUrl = "https://services.onetcenter.org/ws/about"
  const res = await fetch(aboutUrl, {
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
    sample: res.ok
      ? parsed
      : {
          username_preview: maskOnetCredentialPreview(rawU),
          response_preview: text.slice(0, 400),
        },
    error: res.ok ? undefined : text.slice(0, 500),
  }
}
