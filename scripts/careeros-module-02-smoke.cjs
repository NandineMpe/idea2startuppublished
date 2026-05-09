/**
 * CareerOS Module 0.2 — API credential smoke checks (no secrets logged).
 * Loads env files from repo root; `.env.vercel.preview` overrides when present
 * (Preview holds CareerOS keys while Development may not).
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
    CAREERONESTOP_API_KEY,
    CAREERONESTOP_USER_ID,
    CAREERONESTOP_API_TOKEN,
    ADZUNA_APP_ID,
    ADZUNA_APP_KEY,
    BLS_API_KEY,
    LEVELSFYI_API_KEY,
    LEVELSFYI_API_BASE_URL,
    LEVELS_API_KEY,
  } = process.env

  const levelsKey = LEVELSFYI_API_KEY || LEVELS_API_KEY

  // --- O*NET (Web Services: either API key as username with empty password,
  // or ONET_USERNAME + ONET_PASSWORD — matches common dashboard layouts.)
  let onetAuthHeader = null
  if (ONET_USERNAME && ONET_PASSWORD) {
    onetAuthHeader = `Basic ${Buffer.from(`${ONET_USERNAME}:${ONET_PASSWORD}`).toString("base64")}`
  } else if (ONET_API_KEY) {
    onetAuthHeader = `Basic ${Buffer.from(`${ONET_API_KEY}:`).toString("base64")}`
  }

  if (!onetAuthHeader) {
    ok(
      "ONET",
      undefined,
      "FAIL missing ONET_API_KEY or ONET_USERNAME+ONET_PASSWORD"
    )
  } else {
    const r = await fetch(
      "https://services.onetcenter.org/ws/online/occupations?keyword=software",
      { headers: { Authorization: onetAuthHeader } }
    )
    ok(
      "ONET",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${(await r.text()).slice(0, 120)}`
    )
  }

  // --- CareerOneStop (Bearer + userId in path per API docs)
  const cosToken = CAREERONESTOP_API_TOKEN || CAREERONESTOP_API_KEY
  const cosUserId = CAREERONESTOP_USER_ID

  if (cosUserId && cosToken) {
    const url = `https://api.careeronestop.org/v1/occupation/${encodeURIComponent(cosUserId)}/Software%20Developer/94107/25`
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${cosToken}` },
    })
    const text = await r.text()
    ok(
      "CareerOneStop",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${text.slice(0, 120)}`
    )
  } else if (cosToken && !cosUserId) {
    const url = `https://api.careeronestop.org/v1/occupation/${encodeURIComponent(cosToken)}/Software%20Developer/94107/25`
    const r = await fetch(url)
    ok(
      "CareerOneStop",
      r.status,
      r.ok
        ? "PASS (legacy path token only)"
        : `FAIL try CAREERONESTOP_USER_ID + Bearer token; body_snippet=${(await r.text()).slice(0, 120)}`
    )
  } else {
    ok(
      "CareerOneStop",
      undefined,
      "FAIL missing CAREERONESTOP_USER_ID + CAREERONESTOP_API_TOKEN (or legacy CAREERONESTOP_API_KEY)"
    )
  }

  // --- Adzuna
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    ok(
      "Adzuna",
      undefined,
      "FAIL missing ADZUNA_APP_ID or ADZUNA_APP_KEY"
    )
  } else {
    const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${encodeURIComponent(ADZUNA_APP_ID)}&app_key=${encodeURIComponent(ADZUNA_APP_KEY)}&results_per_page=1&what=software%20engineer`
    const r = await fetch(url)
    ok(
      "Adzuna",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${(await r.text()).slice(0, 120)}`
    )
  }

  // --- BLS
  if (!BLS_API_KEY) {
    ok("BLS", undefined, "FAIL missing BLS_API_KEY")
  } else {
    const r = await fetch(
      "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesid: ["OEU0000000000000151252000"],
          registrationkey: BLS_API_KEY,
        }),
      }
    )
    const text = await r.text()
    ok(
      "BLS",
      r.status,
      r.ok ? "PASS" : `FAIL body_snippet=${text.slice(0, 200)}`
    )
  }

  // --- Levels.fyi (enterprise base URL from onboarding; optional)
  if (!levelsKey) {
    ok(
      "Levels.fyi",
      undefined,
      "FAIL missing LEVELSFYI_API_KEY (or LEVELS_API_KEY alias)"
    )
  } else if (LEVELSFYI_API_BASE_URL) {
    const base = LEVELSFYI_API_BASE_URL.replace(/\/$/, "")
    const probe = `${base}/health`
    let r
    try {
      r = await fetch(probe, {
        headers: { Authorization: `Bearer ${levelsKey}` },
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
        : `FAIL ${body.slice(0, 120)} (adjust LEVELSFYI_API_BASE_URL probe path)`
    )
  } else {
    ok(
      "Levels.fyi",
      undefined,
      "SKIP HTTP (set LEVELSFYI_API_BASE_URL from Levels onboarding); key present in env"
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
