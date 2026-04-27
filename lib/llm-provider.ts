/**
 * **Alibaba DashScope** (Model Studio), OpenAI-compatible API. Base defaults to
 * `dashscope-intl` (Singapore / international; set `DASHSCOPE_REGION` for us/cn/hk).
 * Set `LLM_BASE_URL` / `DASHSCOPE_BASE_URL` to override. Model: `LLM_MODEL` / `QWEN_MODEL`, else
 * `qwen3-max-preview` (DashScope OpenAI-compatible name; `qwen3.6-max-preview` is normalized to this).
 */
import { createOpenAI } from "@ai-sdk/openai"

/** International endpoint (incl. Singapore). Default when `DASHSCOPE_REGION` is unset. */
const DASHSCOPE_BASE_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_US = "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_CN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_HK = "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1"
/** Per Model Studio OpenAI-compatible docs (Singapore intl); not `qwen3.6-max-preview` (rejected on many endpoints). */
const DEFAULT_DASHSCOPE_QWEN_MODEL = "qwen3-max-preview"
const KNOWN_UNSUPPORTED_DASHSCOPE_MODELS = new Set(["qwen3-235b-a22b"])
/** Legacy model ids in env that we normalize to a working name (non-DashScope hosts). */
const LEGACY_LLM_REMAP_TARGET = "qwen3-max-preview"

/** Dynamic `process.env[name]` reads — avoids build-time inlining of missing keys on some Next bundles. */
function envTrim(name: string): string {
  const v = process.env[name]
  return typeof v === "string" ? v.trim() : ""
}

function dashscopeBaseFromEnv(): string | null {
  const region = process.env.DASHSCOPE_REGION?.trim().toLowerCase()
  if (region === "us") return DASHSCOPE_BASE_US
  if (region === "cn" || region === "beijing") return DASHSCOPE_BASE_CN
  if (region === "hk" || region === "hongkong") return DASHSCOPE_BASE_HK
  if (region === "intl" || region === "singapore" || region === "sg") return DASHSCOPE_BASE_INTL
  return null
}

function isDashScopeBaseUrl(baseUrl: string): boolean {
  return /dashscope|aliyuncs\.com/i.test(baseUrl)
}

function normalizeDashScopeModelId(modelId: string): string {
  const trimmed = modelId.trim()
  if (trimmed === "qwen3.6-max-preview" || trimmed === "qwen/qwen3.6-max-preview")
    return DEFAULT_DASHSCOPE_QWEN_MODEL
  if (trimmed === "qwen/qwen3.6-plus" || trimmed === "qwen3.6-plus") return DEFAULT_DASHSCOPE_QWEN_MODEL
  if (trimmed === "qwen3-235b-a22b") return DEFAULT_DASHSCOPE_QWEN_MODEL
  return trimmed
}

/** Remap known-bad or legacy `LLM_MODEL` strings for non-DashScope hosts. */
function normalizeNonDashScopeModelId(modelId: string): string {
  const trimmed = modelId.trim()
  if (trimmed === "qwen3.6-max-preview" || trimmed === "qwen/qwen3.6-max-preview")
    return LEGACY_LLM_REMAP_TARGET
  if (trimmed === "qwen3-235b-a22b") return LEGACY_LLM_REMAP_TARGET
  if (trimmed === "qwen/qwen3.6-plus" || trimmed === "qwen3.6-plus") return LEGACY_LLM_REMAP_TARGET
  if (trimmed === "qwen/qwen3.5-plus" || trimmed === "qwen3.5-plus") return LEGACY_LLM_REMAP_TARGET
  if (KNOWN_UNSUPPORTED_DASHSCOPE_MODELS.has(trimmed)) return LEGACY_LLM_REMAP_TARGET
  return trimmed
}

/**
 * OpenAI-compatible base URL.
 * - `LLM_BASE_URL` / `DASHSCOPE_BASE_URL` override everything.
 * - If `DASHSCOPE_API_KEY` is set: region-based DashScope, else intl.
 * - Else: default `dashscope-intl` (expect `DASHSCOPE_API_KEY` or `LLM_API_KEY`).
 */
export function getLlmBaseUrl(): string {
  const explicit = envTrim("LLM_BASE_URL") || envTrim("DASHSCOPE_BASE_URL")
  if (explicit) return explicit

  if (envTrim("DASHSCOPE_API_KEY")) {
    return dashscopeBaseFromEnv() ?? DASHSCOPE_BASE_INTL
  }

  return DASHSCOPE_BASE_INTL
}

/**
 * API key for the resolved base URL.
 * `LLM_API_KEY` wins; DashScope base uses `DASHSCOPE_API_KEY`; other hosts need `LLM_API_KEY`.
 */
export function getLlmApiKey(): string {
  const generic = envTrim("LLM_API_KEY")
  if (generic) return generic

  const base = getLlmBaseUrl()
  if (isDashScopeBaseUrl(base)) {
    return envTrim("DASHSCOPE_API_KEY")
  }
  if (isOpenRouterBaseUrl(base)) {
    return envTrim("OPENROUTER_API_KEY")
  }
  return envTrim("DASHSCOPE_API_KEY")
}

function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return /openrouter\.ai/i.test(baseUrl)
}

/** OpenAI-compatible proxy hosts (e.g. openrouter) may require Referer. */
function openRouterHeaderDefaults(): Record<string, string> {
  const referer =
    envTrim("OPENROUTER_HTTP_REFERER") ||
    envTrim("NEXT_PUBLIC_APP_URL") ||
    (envTrim("VERCEL_URL") ? `https://${envTrim("VERCEL_URL")}` : "") ||
    "https://usejuno-ai.com"
  const title = envTrim("OPENROUTER_APP_TITLE") || "Juno"
  return { "HTTP-Referer": referer, "X-Title": title }
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmApiKey())
}

/** Default model: `qwen3-max-preview`. `LLM_MODEL` / `QWEN_MODEL` override. */
export function getDefaultModelId(): string {
  const baseUrl = getLlmBaseUrl()
  const configured = envTrim("LLM_MODEL") || envTrim("QWEN_MODEL")

  if (configured) {
    return isDashScopeBaseUrl(baseUrl)
      ? normalizeDashScopeModelId(configured)
      : normalizeNonDashScopeModelId(configured)
  }

  return DEFAULT_DASHSCOPE_QWEN_MODEL
}

/**
 * DashScope (OpenAI-compatible) returns 400 for non-streaming chat unless `enable_thinking` is
 * explicitly `false` ("parameter.enable_thinking must be set to false for non-streaming calls").
 * `generateText` is non-streaming, so the Vercel AI SDK would otherwise fail for Qwen3+ models.
 */
function dashScopeCompatibleFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const href =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url
  if (!/dashscope|aliyuncs\.com/i.test(href) || !/chat\/completions/i.test(href) || !init?.body) {
    return fetch(input, init)
  }
  if (typeof init.body !== "string") {
    return fetch(input, init)
  }
  try {
    const j = JSON.parse(init.body) as Record<string, unknown>
    if (j.stream === true) return fetch(input, init)
    if (j.enable_thinking === undefined) {
      j.enable_thinking = false
    }
    return fetch(input, { ...init, body: JSON.stringify(j) })
  } catch {
    return fetch(input, init)
  }
}

function createLlmOpenAIClient() {
  const baseUrl = getLlmBaseUrl()
  return createOpenAI({
    apiKey: getLlmApiKey() || "",
    baseURL: baseUrl,
    headers: {
      ...(isOpenRouterBaseUrl(baseUrl) ? openRouterHeaderDefaults() : {}),
    },
    ...(isDashScopeBaseUrl(baseUrl) ? { fetch: dashScopeCompatibleFetch } : {}),
  })
}

/** Vercel AI SDK model. Client is created per call so env is read at request time. */
export function qwenModel() {
  return createLlmOpenAIClient()(getDefaultModelId())
}

/** Preferred alias — same implementation as `qwenModel()`. */
export const llmModel = qwenModel

/** User-facing error when routes guard on a missing LLM key. */
export const LLM_API_KEY_MISSING_MESSAGE =
  "Set DASHSCOPE_API_KEY (Model Studio) in Vercel for Production, redeploy, or set LLM_API_KEY. Add the same for Preview if you use it."
