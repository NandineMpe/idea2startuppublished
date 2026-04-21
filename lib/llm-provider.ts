/**
 * Production LLM path: **OpenRouter** (`OPENROUTER_API_KEY` in Vercel), OpenAI-compatible API.
 * Default model: Nemotron 3 Super (free). Override with `LLM_MODEL` or legacy `QWEN_MODEL`.
 * Optional legacy hosts: Alibaba DashScope, or any `LLM_BASE_URL`.
 * Use `llmModel()` / `qwenModel()` with the Vercel AI SDK (`generateText`, `streamText`, etc.).
 */
import { createOpenAI } from "@ai-sdk/openai"

const DASHSCOPE_BASE_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_US = "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_CN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_HK = "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1"
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
/** DashScope stable alias (Qwen-Plus tier; not tied to removed qwen3.6-plus SKUs). */
const DEFAULT_DASHSCOPE_QWEN_MODEL = "qwen-plus"
/** OpenRouter: NVIDIA Nemotron 3 Super (free tier). */
const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
const KNOWN_UNSUPPORTED_DASHSCOPE_MODELS = new Set(["qwen3-235b-a22b"])

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
  if (trimmed === "qwen/qwen3.6-plus" || trimmed === "qwen3.6-plus") return DEFAULT_DASHSCOPE_QWEN_MODEL
  if (trimmed === "qwen3-235b-a22b") return DEFAULT_DASHSCOPE_QWEN_MODEL
  return trimmed
}

/** DashScope-only names that OpenRouter and other hosts reject (see server_error Unsupported model). */
function normalizeNonDashScopeModelId(modelId: string): string {
  const trimmed = modelId.trim()
  if (trimmed === "qwen3-235b-a22b") return DEFAULT_OPENROUTER_MODEL
  if (trimmed === "qwen/qwen3.6-plus" || trimmed === "qwen3.6-plus") return DEFAULT_OPENROUTER_MODEL
  if (trimmed === "qwen/qwen3.5-plus" || trimmed === "qwen3.5-plus") return DEFAULT_OPENROUTER_MODEL
  if (KNOWN_UNSUPPORTED_DASHSCOPE_MODELS.has(trimmed)) return DEFAULT_OPENROUTER_MODEL
  return trimmed
}

/**
 * OpenAI-compatible base URL.
 * - Set LLM_BASE_URL (or *_BASE_URL) to override.
 * - Implicit routing when no base URL is set: **OpenRouter wins over DashScope** if both API keys exist,
 *   so a leftover DASHSCOPE_API_KEY does not block OpenRouter after you add OPENROUTER_API_KEY.
 * - With no keys, defaults to OpenRouter URL (calls fail until a key is set).
 */
export function getLlmBaseUrl(): string {
  const explicit =
    envTrim("LLM_BASE_URL") || envTrim("DASHSCOPE_BASE_URL") || envTrim("OPENROUTER_BASE_URL")
  if (explicit) return explicit

  if (envTrim("OPENROUTER_API_KEY")) {
    return OPENROUTER_BASE_URL
  }

  if (envTrim("DASHSCOPE_API_KEY")) {
    return dashscopeBaseFromEnv() ?? DASHSCOPE_BASE_INTL
  }

  return OPENROUTER_BASE_URL
}

/**
 * API key for the resolved base URL.
 * LLM_API_KEY overrides; otherwise the key must match the host (OpenRouter vs DashScope).
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
  // Custom LLM_BASE_URL: prefer OpenRouter key, then DashScope (legacy).
  return envTrim("OPENROUTER_API_KEY") || envTrim("DASHSCOPE_API_KEY")
}

function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return /openrouter\.ai/i.test(baseUrl)
}

/** OpenRouter recommends HTTP-Referer; some requests fail without it. */
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

/**
 * Model id for the provider.
 * OpenRouter default: nvidia/nemotron-3-super-120b-a12b:free.
 * DashScope legacy default: qwen-plus.
 * Override with `LLM_MODEL` or legacy `QWEN_MODEL`.
 */
export function getDefaultModelId(): string {
  const baseUrl = getLlmBaseUrl()
  const configured = envTrim("LLM_MODEL") || envTrim("QWEN_MODEL")

  if (configured) {
    return isDashScopeBaseUrl(baseUrl)
      ? normalizeDashScopeModelId(configured)
      : normalizeNonDashScopeModelId(configured)
  }

  return isDashScopeBaseUrl(baseUrl) ? DEFAULT_DASHSCOPE_QWEN_MODEL : DEFAULT_OPENROUTER_MODEL
}

function createLlmOpenAIClient() {
  const baseUrl = getLlmBaseUrl()
  return createOpenAI({
    apiKey: getLlmApiKey() || "",
    baseURL: baseUrl,
    headers: {
      ...(isOpenRouterBaseUrl(baseUrl) ? openRouterHeaderDefaults() : {}),
    },
  })
}

/**
 * Language model for the Vercel AI SDK (generateText, streamText, etc.).
 * Production: OpenRouter via `OPENROUTER_API_KEY` (and optional `LLM_MODEL`).
 * Client is created per call so Vercel env vars are always read at request time.
 */
export function qwenModel() {
  return createLlmOpenAIClient()(getDefaultModelId())
}

/** Preferred alias — same implementation as `qwenModel()`. */
export const llmModel = qwenModel

/** User-facing error when routes guard on a missing LLM key. */
export const LLM_API_KEY_MISSING_MESSAGE =
  "Add OPENROUTER_API_KEY to Vercel → Environment Variables for Production, then redeploy. Or set LLM_API_KEY. (Preview deployments need the same vars under Preview.)"
