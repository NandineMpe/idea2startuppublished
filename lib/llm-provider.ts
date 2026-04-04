import { createOpenAI } from "@ai-sdk/openai"

/** Alibaba Model Studio (DashScope) OpenAI-compatible endpoints — see Alibaba Cloud docs for your region. */
const DASHSCOPE_BASE_INTL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_US = "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_CN = "https://dashscope.aliyuncs.com/compatible-mode/v1"
const DASHSCOPE_BASE_HK = "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1"

function dashscopeBaseFromEnv(): string | null {
  const r = process.env.DASHSCOPE_REGION?.trim().toLowerCase()
  if (r === "us") return DASHSCOPE_BASE_US
  if (r === "cn" || r === "beijing") return DASHSCOPE_BASE_CN
  if (r === "hk" || r === "hongkong") return DASHSCOPE_BASE_HK
  if (r === "intl" || r === "singapore" || r === "sg") return DASHSCOPE_BASE_INTL
  return null
}

/**
 * OpenAI-compatible base URL.
 * - Set LLM_BASE_URL to override (required if you use LLM_API_KEY alone and it is not DashScope).
 * - With only DASHSCOPE_API_KEY (and no OPENROUTER_API_KEY), defaults to international DashScope unless DASHSCOPE_REGION is set.
 * - Otherwise defaults to OpenRouter.
 */
export function getLlmBaseUrl(): string {
  const explicit =
    process.env.LLM_BASE_URL?.trim() ||
    process.env.OPENROUTER_BASE_URL?.trim() ||
    process.env.DASHSCOPE_BASE_URL?.trim()
  if (explicit) return explicit

  const dashKey = Boolean(process.env.DASHSCOPE_API_KEY?.trim())
  const openRouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim())

  if (dashKey && !openRouterKey) {
    return dashscopeBaseFromEnv() ?? DASHSCOPE_BASE_INTL
  }

  return "https://openrouter.ai/api/v1"
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
 * - OpenRouter default: qwen/qwen3.6-plus (override with QWEN_MODEL).
 * - Alibaba Model Studio (DashScope) default: qwen3.6-plus — matches OpenAI-compatible examples in Model Studio docs.
 */
export function getDefaultModelId(): string {
  const fromEnv = process.env.QWEN_MODEL?.trim()
  if (fromEnv) return fromEnv

  const dashKey = Boolean(process.env.DASHSCOPE_API_KEY?.trim())
  const openRouterKey = Boolean(process.env.OPENROUTER_API_KEY?.trim())
  if (dashKey && !openRouterKey) {
    return "qwen3.6-plus"
  }

  return "qwen/qwen3.6-plus"
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
 * Default: Qwen 3.6 via an OpenAI-compatible API.
 */
export function qwenModel() {
  return openaiCompatible(getDefaultModelId())
}

/** User-facing error when routes guard on a missing LLM key. */
export const LLM_API_KEY_MISSING_MESSAGE =
  "Set LLM_API_KEY, DASHSCOPE_API_KEY (Alibaba Model Studio), or OPENROUTER_API_KEY"
