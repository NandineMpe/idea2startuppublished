/** ElevenLabs ConvAI agent for Juno CareerOS (dashboard name: My Agent). */
export const CAREEROS_CONVAI_AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_CAREEROS_AGENT_ID?.trim() ||
  process.env.ELEVENLABS_CAREEROS_AGENT_ID?.trim() ||
  "agent_6601ks30cwkzfw6t48433aw8w5yq"

/** Official CDN first (per ElevenLabs deploy docs), then unpkg embed bundle. */
export const CONVAI_WIDGET_SCRIPT_URLS = [
  "https://elevenlabs.io/convai-widget/index.js",
  "https://unpkg.com/@elevenlabs/convai-widget-embed",
] as const

/** @deprecated use CONVAI_WIDGET_SCRIPT_URLS */
export const CONVAI_WIDGET_SCRIPT_URL = CONVAI_WIDGET_SCRIPT_URLS[1]
