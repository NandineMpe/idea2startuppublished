/**
 * Default app LLM: OpenAI-compatible API (OpenRouter, DashScope, or custom LLM_BASE_URL).
 * OpenRouter default: Nemotron 3 Super (free). DashScope default: qwen-plus.
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
/** OpenRouter: NVIDIA Nemotron 3 Super (free tier). Override with QWEN_MODEL. */
const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
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

/**
 * API key for the resolved base URL.
 * LLM_API_KEY overrides; otherwise the key must match the host (OpenRouter vs DashScope).
 */
export function getLlmApiKey(): string {
  const generic = process.env.LLM_API_KEY?.trim()
  if (generic) return generic

  const base = getLlmBaseUrl()
  if (isDashScopeBaseUrl(base)) {
    return process.env.DASHSCOPE_API_KEY?.trim() || ""
  }
  if (isOpenRouterBaseUrl(base)) {
    return process.env.OPENROUTER_API_KEY?.trim() || ""
  }
  // Custom LLM_BASE_URL: prefer OpenRouter key, then DashScope (legacy).
  return (
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.DASHSCOPE_API_KEY?.trim() ||
    ""
  )
}

function isOpenRouterBaseUrl(baseUrl: string): boolean {
  return /openrouter\.ai/i.test(baseUrl)
}

/** OpenRouter recommends HTTP-Referer; some requests fail without it. */
function openRouterHeaderDefaults(): Record<string, string> {
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
    "https://usejuno-ai.com"
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Juno"
  return { "HTTP-Referer": referer, "X-Title": title }
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmApiKey())
}

/**
 * Model id for the provider.
 * DashScope default: qwen-plus.
 * OpenRouter default: nvidia/nemotron-3-super-120b-a12b:free.
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

  return isDashScopeBaseUrl(baseUrl) ? DEFAULT_DASHSCOPE_QWEN_MODEL : DEFAULT_OPENROUTER_MODEL
}

const openaiCompatible = createOpenAI({
  apiKey: getLlmApiKey() || "",
  baseURL: getLlmBaseUrl(),
  headers: {
    ...(isOpenRouterBaseUrl(getLlmBaseUrl()) ? openRouterHeaderDefaults() : {}),
  },
})

/**
 * Language model for the Vercel AI SDK (generateText, streamText, etc.).
 * Uses OpenRouter Nemotron (free) or DashScope qwen-plus depending on base URL / env.
 */
export function qwenModel() {
  return openaiCompatible(getDefaultModelId())
}

/** User-facing error when routes guard on a missing LLM key. */
export const LLM_API_KEY_MISSING_MESSAGE =
  "Set LLM_API_KEY, DASHSCOPE_API_KEY (Alibaba Model Studio), or OPENROUTER_API_KEY"
