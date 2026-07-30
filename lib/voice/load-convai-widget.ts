import { CONVAI_WIDGET_SCRIPT_URLS } from "@/lib/voice/careeros-convai-agent"

let loadPromise: Promise<void> | null = null

function scriptAlreadyLoaded(url: string): boolean {
  return Boolean(document.querySelector(`script[src="${url}"]`))
}

function injectScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = url
    script.async = true
    script.type = "text/javascript"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${url}`))
    document.body.appendChild(script)
  })
}

/** Loads the ElevenLabs ConvAI embed script once (official CDN, then unpkg fallback). */
export function loadConvaiWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    for (const url of CONVAI_WIDGET_SCRIPT_URLS) {
      if (scriptAlreadyLoaded(url)) return
      try {
        await injectScript(url)
        return
      } catch {
        // try next CDN
      }
    }
    loadPromise = null
    throw new Error("Failed to load ElevenLabs ConvAI widget from all CDNs")
  })()

  return loadPromise
}
