/**
 * One-shot LLM credential check (same routing as lib/llm-provider.ts).
 * Production expects OPENROUTER_API_KEY (Vercel). Run:
 *   node --env-file=.env --env-file=.env.local scripts/check-llm-health.mjs
 * Does not print API keys.
 */
const DASHSCOPE_BASE_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
const DEFAULT_DASHSCOPE_QWEN_MODEL = "qwen-plus"
const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

function dashscopeBaseFromEnv() {
  const region = process.env.DASHSCOPE_REGION?.trim().toLowerCase()
  if (region === "us") return "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
  if (region === "cn" || region === "beijing") return "https://dashscope.aliyuncs.com/compatible-mode/v1"
  if (region === "hk" || region === "hongkong") return "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1"
  if (region === "intl" || region === "singapore" || region === "sg") return DASHSCOPE_BASE_INTL
  return null
}

function isDashScopeBaseUrl(baseUrl) {
  return /dashscope|aliyuncs\.com/i.test(baseUrl)
}

function getLlmBaseUrl() {
  const explicit =
    process.env.LLM_BASE_URL?.trim() ||
    process.env.DASHSCOPE_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim()
  if (explicit) return explicit
  if (process.env.OPENROUTER_API_KEY?.trim()) {
    return OPENROUTER_BASE_URL
  }
  if (process.env.DASHSCOPE_API_KEY?.trim()) {
    return dashscopeBaseFromEnv() ?? DASHSCOPE_BASE_INTL
  }
  return OPENROUTER_BASE_URL
}

function getLlmApiKey() {
  const generic = process.env.LLM_API_KEY?.trim()
  if (generic) return generic
  const base = getLlmBaseUrl()
  if (isDashScopeBaseUrl(base)) {
    return process.env.DASHSCOPE_API_KEY?.trim() || ""
  }
  if (/openrouter\.ai/i.test(base)) {
    return process.env.OPENROUTER_API_KEY?.trim() || ""
  }
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    ""
  )
}

function getDefaultModelId() {
  const baseUrl = getLlmBaseUrl()
  const configured = process.env.LLM_MODEL?.trim() || process.env.QWEN_MODEL?.trim()
  if (configured) {
    const t = configured
    if (isDashScopeBaseUrl(baseUrl)) {
      if (t === "qwen/qwen3.6-plus" || t === "qwen3.6-plus") return DEFAULT_DASHSCOPE_QWEN_MODEL
      if (t === "qwen3-235b-a22b") return DEFAULT_DASHSCOPE_QWEN_MODEL
      return t
    }
    if (t === "qwen3-235b-a22b") return DEFAULT_OPENROUTER_MODEL
    if (t === "qwen/qwen3.6-plus" || t === "qwen3.6-plus") return DEFAULT_OPENROUTER_MODEL
    if (t === "qwen/qwen3.5-plus" || t === "qwen3.5-plus") return DEFAULT_OPENROUTER_MODEL
    return t
  }
  return isDashScopeBaseUrl(baseUrl) ? DEFAULT_DASHSCOPE_QWEN_MODEL : DEFAULT_OPENROUTER_MODEL
}

const apiKey = getLlmApiKey()
const baseUrl = getLlmBaseUrl()
const model = getDefaultModelId()

let keySource = "(none)"
if (process.env.LLM_API_KEY?.trim()) keySource = "LLM_API_KEY"
else if (/openrouter\.ai/i.test(baseUrl) && process.env.OPENROUTER_API_KEY?.trim())
  keySource = "OPENROUTER_API_KEY"
else if (isDashScopeBaseUrl(baseUrl) && process.env.DASHSCOPE_API_KEY?.trim())
  keySource = "DASHSCOPE_API_KEY"
else if (process.env.OPENROUTER_API_KEY?.trim()) keySource = "OPENROUTER_API_KEY"
else if (process.env.DASHSCOPE_API_KEY?.trim()) keySource = "DASHSCOPE_API_KEY"

console.log("--- LLM health check ---")
console.log("Key source:", keySource)
console.log("Base URL:", baseUrl)
console.log("Model:", model)
console.log("API key present:", Boolean(apiKey))

if (!apiKey) {
  console.log("\nRESULT: FAIL — no API key in env (check .env.local / Vercel).")
  process.exit(1)
}

const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`
const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
}
if (/openrouter\.ai/i.test(baseUrl)) {
  headers["HTTP-Referer"] =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
    "https://usejuno-ai.com"
  headers["X-Title"] = process.env.OPENROUTER_APP_TITLE?.trim() || "Juno"
}

const body = JSON.stringify({
  model,
  messages: [{ role: "user", content: "Reply with exactly: ok" }],
  max_tokens: 20,
})

try {
  const res = await fetch(url, { method: "POST", headers, body })
  const text = await res.text()
  let snippet = text.slice(0, 800)
  if (text.length > 800) snippet += "…"

  console.log("\nHTTP status:", res.status, res.statusText)

  if (!res.ok) {
    console.log("Response body (truncated):", snippet)
    console.log("\nRESULT: FAIL — provider returned an error (key may be invalid, expired, or wrong region/base URL).")
    process.exit(1)
  }

  let reply = ""
  try {
    const j = JSON.parse(text)
    reply = j?.choices?.[0]?.message?.content ?? ""
  } catch {
    console.log("Response (truncated):", snippet)
    console.log("\nRESULT: FAIL — could not parse JSON (unexpected response).")
    process.exit(1)
  }

  console.log("Assistant reply (trimmed):", reply.trim().slice(0, 200))
  console.log("\nRESULT: OK — credentials work for this base URL + model.")
  process.exit(0)
} catch (e) {
  console.error("\nRESULT: FAIL — network or fetch error:", e?.message || e)
  process.exit(1)
}
