/**
 * CareerOS Module 0.2 — API credential smoke checks (no secrets logged).
 * Loads env files from repo root; `.env.vercel.preview` overrides when present
 * (Preview holds CareerOS keys while Development may not).
 *
 * Doc alignment:
 * - O*NET v2: https://api-v2.onetcenter.org/ + header X-API-Key (migration + overview)
 * - CareerOneStop: GET /v1/occupation/{userId}/{keyword}/{location} + Bearer token
 * - Adzuna: app_id + app_key query params (developer.adzuna.com)
 * - BLS v2: POST JSON with registrationkey (api.bls.gov)
 * - JSearch: RapidAPI host + X-RapidAPI-Key (module readiness curl)
 * - TheirStack: Bearer + /v1/jobs
 */
const fs = require("fs")
const path = require("path")

function loadEnvFile(envPath, override = false) {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split(/\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (override || !(key in process.env)) process.env[key] = val
  }
}

function loadEnvLocal() {
  const root = path.join(__dirname, "..")
  loadEnvFile(path.join(root, ".env.local"), false)
  loadEnvFile(path.join(root, ".env"), false)
  loadEnvFile(path.join(root, ".env.vercel.preview"), true)
  loadEnvFile(path.join(root, ".env.vercel.production"), true)
}

function ok(name, status, detail) {
  const st = status === undefined ? "skip" : String(status)
  console.log(`[${name}] ${detail || ""} (http=${st})`)
}

async function main() {
  loadEnvLocal()

  const {
    ONET_API_KEY,
    ONET_USERNAME,
    ONET_PASSWORD,
    ONET_API_BASE_URL,
    CAREERONESTOP_API_KEY,
    CAREERONESTOP_USER_ID,
    CAREERONESTOP_API_TOKEN,
    ADZUNA_APP_ID,
    ADZUNA_APP_KEY,
    BLS_API_KEY,
    LEVELSFYI_API_KEY,
    LEVELSFYI_API_BASE_URL,
    LEVELS_API_KEY,
    JSEARCH_API_KEY,
    THEIRSTACK_API_KEY,
  } = process.env

  const levelsKey = LEVELSFYI_API_KEY || LEVELS_API_KEY

  // --- O*NET v2 (preferred): X-API-Key @ api-v2.onetcenter.org/online/search
  const onetKey = ONET_API_KEY?.trim()
  const onetBase =
    (ONET_API_BASE_URL && ONET_API_BASE_URL.trim().replace(/\/$/, "")) ||
    "https://api-v2.onetcenter.org"

  if (onetKey) {
    const url = `${onetBase}/online/search?keyword=${encodeURIComponent("software")}`
    const r = await fetch(url, {
      headers: {
        "X-API-Key": onetKey,
        Accept: "application/json",
      },
    })
    const body = await r.text()
    ok(
      "ONET",
      r.status,
      r.ok ? "PASS v2 (X-API-Key)" : `FAIL v2 body_snippet=${body.slice(0, 120)}`,
    )
  } else {
    let onetAuthHeader = null
    if (ONET_USERNAME?.trim() && ONET_PASSWORD?.trim()) {
      onetAuthHeader = `Basic ${Buffer.from(`${ONET_USERNAME}:${ONET_PASSWORD}`).toString("base64")}`
    }

    if (!onetAuthHeader) {
      ok(
        "ONET",
        undefined,
        "FAIL set ONET_API_KEY (v2) or ONET_USERNAME + ONET_PASSWORD (legacy v1.9)",
      )
    } else {
      const r = await fetch(
        "https://services.onetcenter.org/ws/online/occupations?keyword=software",
        { headers: { Authorization: onetAuthHeader } },
      )
      ok(
        "ONET",
        r.status,
        r.ok ? "PASS legacy ws" : `FAIL legacy body_snippet=${(await r.text()).slice(0, 120)}`,
      )
    }
  }

  // --- CareerOneStop: GET /v1/occupation/{userId}/{keyword}/{location}
  const cosToken = CAREERONESTOP_API_TOKEN || CAREERONESTOP_API_KEY
  const cosUserId = CAREERONESTOP_USER_ID?.trim()

  if (cosUserId && cosToken?.trim()) {
    const keyword = "Software Developers"
    const location = "94107"
    const url = `https://api.careeronestop.org/v1/occupation/${encodeURIComponent(cosUserId)}/${encodeURIComponent(keyword)}/${encodeURIComponent(location)}`
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${cosToken.trim()}` },
    })
    const text = await r.text()
    ok(
      "CareerOneStop",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${text.slice(0, 120)}`,
    )
  } else if (cosToken?.trim() && !cosUserId) {
    ok(
      "CareerOneStop",
      undefined,
      "FAIL set CAREERONESTOP_USER_ID (path segment) + CAREERONESTOP_API_TOKEN",
    )
  } else {
    ok(
      "CareerOneStop",
      undefined,
      "FAIL missing CAREERONESTOP_USER_ID and/or CAREERONESTOP_API_TOKEN",
    )
  }

  // --- Adzuna (both app_id and app_key required)
  if (!ADZUNA_APP_ID?.trim() || !ADZUNA_APP_KEY?.trim()) {
    ok(
      "Adzuna",
      undefined,
      "FAIL missing ADZUNA_APP_ID or ADZUNA_APP_KEY (both required per Adzuna docs)",
    )
  } else {
    const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${encodeURIComponent(ADZUNA_APP_ID.trim())}&app_key=${encodeURIComponent(ADZUNA_APP_KEY.trim())}&results_per_page=1&what=software%20engineer`
    const r = await fetch(url)
    ok(
      "Adzuna",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${(await r.text()).slice(0, 120)}`,
    )
  }

  // --- BLS Public Data API v2
  if (!BLS_API_KEY?.trim()) {
    ok("BLS", undefined, "FAIL missing BLS_API_KEY")
  } else {
    const r = await fetch(
      "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesid: ["OEU0000000000000151252000"],
          registrationkey: BLS_API_KEY.trim(),
        }),
      },
    )
    const text = await r.text()
    ok(
      "BLS",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${text.slice(0, 200)}`,
    )
  }

  // --- JSearch (RapidAPI)
  if (!JSEARCH_API_KEY?.trim()) {
    ok("JSearch", undefined, "SKIP missing JSEARCH_API_KEY")
  } else {
    const r = await fetch(
      "https://jsearch.p.rapidapi.com/search?query=software%20engineer&page=1&num_pages=1",
      {
        headers: {
          "X-RapidAPI-Key": JSEARCH_API_KEY.trim(),
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      },
    )
    ok(
      "JSearch",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${(await r.text()).slice(0, 120)}`,
    )
  }

  // --- TheirStack
  if (!THEIRSTACK_API_KEY?.trim()) {
    ok("TheirStack", undefined, "SKIP missing THEIRSTACK_API_KEY")
  } else {
    const r = await fetch("https://api.theirstack.com/v1/jobs?limit=1", {
      headers: { Authorization: `Bearer ${THEIRSTACK_API_KEY.trim()}` },
    })
    ok(
      "TheirStack",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${(await r.text()).slice(0, 120)}`,
    )
  }

  // --- Levels.fyi (enterprise base URL from onboarding; optional)
  if (!levelsKey?.trim()) {
    ok(
      "Levels.fyi",
      undefined,
      "SKIP missing LEVELSFYI_API_KEY (or LEVELS_API_KEY alias)",
    )
  } else if (LEVELSFYI_API_BASE_URL?.trim()) {
    const base = LEVELSFYI_API_BASE_URL.trim().replace(/\/$/, "")
    const probe = `${base}/health`
    let r
    try {
      r = await fetch(probe, {
        headers: { Authorization: `Bearer ${levelsKey.trim()}` },
      })
    } catch (e) {
      ok("Levels.fyi", undefined, `FAIL fetch ${e.message}`)
      return
    }
    const body = await r.text()
    ok(
      "Levels.fyi",
      r.status,
      r.ok
        ? "PASS"
        : `FAIL ${body.slice(0, 120)} (adjust LEVELSFYI_API_BASE_URL probe path)`,
    )
  } else {
    ok(
      "Levels.fyi",
      undefined,
      "SKIP HTTP (set LEVELSFYI_API_BASE_URL from Levels onboarding); key present in env",
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
