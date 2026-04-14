/**
 * Default app LLM: Qwen via an OpenAI-compatible API (DashScope, OpenRouter, or custom LLM_BASE_URL).
 * Use `qwenModel()` with the Vercel AI SDK (`generateText`, `streamText`, etc.).
 */
import { createOpenAI } from "@ai-sdk/openai"

const DASHSCOPE_BASE_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_US = "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_CN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_HK = "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1"
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
/** DashScope stable alias (Qwen-Plus tier; not tied to removed qwen3.6-plus SKUs). */
const DEFAULT_DASHSCOPE_QWEN_MODEL = "qwen-plus"
/** OpenRouter: Qwen 3.5 tier (avoid qwen3.6 if your account no longer offers it). */
const DEFAULT_OPENROUTER_QWEN_MODEL = "qwen/qwen3.5-plus"
const KNOWN_UNSUPPORTED_DASHSCOPE_MODELS = new Set(["qwen3-235b-a22b"])

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
  if (trimmed === "qwen3-235b-a22b") return DEFAULT_OPENROUTER_QWEN_MODEL
  if (trimmed === "qwen/qwen3.6-plus" || trimmed === "qwen3.6-plus") return DEFAULT_OPENROUTER_QWEN_MODEL
  if (KNOWN_UNSUPPORTED_DASHSCOPE_MODELS.has(trimmed)) return DEFAULT_OPENROUTER_QWEN_MODEL
  return trimmed
}

/**
 * OpenAI-compatible base URL.
 * - Set LLM_BASE_URL to override.
 * - If a DashScope key is present, prefer DashScope unless you explicitly point elsewhere.
 * - Otherwise default to OpenRouter.
 */
export function getLlmBaseUrl(): string {
  const explicit =
    process.env.LLM_BASE_URL?.trim() ||
    process.env.DASHSCOPE_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim()
  if (explicit) return explicit

  if (process.env.DASHSCOPE_API_KEY?.trim()) {
    return dashscopeBaseFromEnv() ?? DASHSCOPE_BASE_INTL
  }

  if (process.env.OPENROUTER_API_KEY?.trim()) {
    return OPENROUTER_BASE_URL
  }

  return OPENROUTER_BASE_URL
}

/** API key for the OpenAI-compatible endpoint (DashScope key from Alibaba Model Studio works here). */
export function getLlmApiKey(): string {
  return (
    process.env.LLM_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    ""
  )
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmApiKey())
}

/**
 * Model id for the provider.
 * DashScope default: qwen-plus.
 * OpenRouter default: qwen/qwen3.5-plus.
 * Override with QWEN_MODEL env var.
 */
export function getDefaultModelId(): string {
  const baseUrl = getLlmBaseUrl()
  const configured = process.env.QWEN_MODEL?.trim()

  if (configured) {
    return isDashScopeBaseUrl(baseUrl)
      ? normalizeDashScopeModelId(configured)
      : normalizeNonDashScopeModelId(configured)
  }

  return isDashScopeBaseUrl(baseUrl) ? DEFAULT_DASHSCOPE_QWEN_MODEL : DEFAULT_OPENROUTER_QWEN_MODEL
}

const openaiCompatible = createOpenAI({
  apiKey: getLlmApiKey() || "",
  baseURL: getLlmBaseUrl(),
  headers: {
    ...(process.env.OPENROUTER_HTTP_REFERER
      ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
      : {}),
    ...(process.env.OPENROUTER_APP_TITLE ? { "X-Title": process.env.OPENROUTER_APP_TITLE } : {}),
  },
})

/**
 * Language model for the Vercel AI SDK (generateText, streamText, etc.).
 * Default: Qwen via an OpenAI-compatible API.
 */
export function qwenModel() {
  return openaiCompatible(getDefaultModelId())
}

/** User-facing error when routes guard on a missing LLM key. */
export const LLM_API_KEY_MISSING_MESSAGE =
  "Set LLM_API_KEY, DASHSCOPE_API_KEY (Alibaba Model Studio), or OPENROUTER_API_KEY"
