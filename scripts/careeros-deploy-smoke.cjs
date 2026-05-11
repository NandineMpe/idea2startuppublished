/**
 * Post-deploy smoke for CareerOS on Vercel (no secrets printed).
 *
 * Env (optional):
 *   CAREEROS_SMOKE_BASE_URL — default https://usejuno-ai.com
 *   VERIFY_TOKEN + JUNO_TEST_USER_ID (or CAREEROS_SMOKE_USER_ID) — full skill-graph check
 *
 * Loads .env.local, .env, .env.vercel.preview, .env.vercel.production from repo root.
 * Optional: CAREEROS_SMOKE_ENV_FILE=/path/to/.env (from `vercel env pull`) overrides keys last.
 *
 * If authenticated skill-graph returns 500 with "Invalid schema: careeros", add `careeros`
 * to Supabase → Database → API Settings → Exposed schemas.
 */
const fs = require("fs")
const path = require("path")

function loadEnvFile(envPath, override = false) {
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split("\n")) {
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
  const extra = process.env.CAREEROS_SMOKE_ENV_FILE?.trim()
  if (extra) loadEnvFile(path.resolve(extra), true)
}

function logLine(tag, httpStatus, detail) {
  const st = httpStatus === undefined ? "—" : String(httpStatus)
  console.log(`[${tag}] http=${st} ${detail || ""}`.trim())
}

async function fetchStatus(url, init) {
  try {
    const res = await fetch(url, init)
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { res, text, json }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const fake = new Response(null, { status: 0 })
    return { res: fake, text: "", json: null, fetchError: msg }
  }
}

async function main() {
  loadEnvLocal()

  const base =
    (process.env.CAREEROS_SMOKE_BASE_URL || "https://usejuno-ai.com").replace(/\/$/, "")
  let failed = false

  // 1) skill-graph without token → 401
  const u1 = `${base}/api/careeros/_verify/skill-graph`
  const r1 = await fetchStatus(u1)
  if (r1.fetchError) {
    logLine("skill-graph:no-token", undefined, `fetch failed: ${r1.fetchError}`)
    console.error("\ncareeros-deploy-smoke: FAILED")
    process.exit(1)
  }
  if (r1.res.status !== 401) {
    logLine("skill-graph:no-token", r1.res.status, "expected 401")
    failed = true
  } else {
    logLine("skill-graph:no-token", r1.res.status, "ok")
  }

  // 2) invalid token → 401
  const u2 = `${base}/api/careeros/_verify/skill-graph?token=invalid&user_id=00000000-0000-4000-8000-000000000001`
  const r2 = await fetchStatus(u2)
  if (r2.fetchError) {
    logLine("skill-graph:bad-token", undefined, `fetch failed: ${r2.fetchError}`)
    failed = true
  } else if (r2.res.status !== 401) {
    logLine("skill-graph:bad-token", r2.res.status, "expected 401")
    failed = true
  } else {
    logLine("skill-graph:bad-token", r2.res.status, "ok")
  }

  // 3) Inngest bundle
  const u3 = `${base}/api/inngest/careeros`
  const r3 = await fetchStatus(u3)
  if (r3.fetchError) {
    logLine("inngest:careeros", undefined, `fetch failed: ${r3.fetchError}`)
    failed = true
  } else if (r3.res.status !== 200) {
    logLine("inngest:careeros", r3.res.status, "expected 200")
    failed = true
  } else {
    const fc = r3.json?.function_count
    const mode = r3.json?.mode
    logLine("inngest:careeros", r3.res.status, `function_count=${fc} mode=${mode}`)
    if (typeof fc !== "number" || fc < 1) {
      console.log("[inngest:careeros] warning: unexpected function_count")
      failed = true
    }
  }

  // 4) Optional authenticated diagnostic
  const token = process.env.VERIFY_TOKEN?.trim()
  const userId = (
    process.env.CAREEROS_SMOKE_USER_ID || process.env.JUNO_TEST_USER_ID
  )?.trim()

  if (!token || !userId) {
    logLine(
      "skill-graph:auth",
      undefined,
      "skip (set VERIFY_TOKEN and JUNO_TEST_USER_ID or CAREEROS_SMOKE_USER_ID)",
    )
  } else {
    const u4 = `${base}/api/careeros/_verify/skill-graph?token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(userId)}`
    const r4 = await fetchStatus(u4)
    if (r4.fetchError) {
      logLine("skill-graph:auth", undefined, `fetch failed: ${r4.fetchError}`)
      failed = true
    } else if (r4.res.status === 200) {
      const issues = Array.isArray(r4.json?.issues) ? r4.json.issues.length : "?"
      logLine("skill-graph:auth", r4.res.status, `ok issues_len=${issues}`)
    } else if (r4.res.status === 500 && String(r4.json?.error || "").includes("Invalid schema")) {
      logLine("skill-graph:auth", r4.res.status, "Invalid schema — expose careeros in Supabase API settings")
      failed = true
    } else {
      logLine("skill-graph:auth", r4.res.status, r4.json?.error || r4.text?.slice(0, 120))
      failed = true
    }
  }

  if (failed) {
    console.error("\ncareeros-deploy-smoke: FAILED")
    process.exit(1)
  }
  console.log("\ncareeros-deploy-smoke: OK")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
