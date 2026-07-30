"use client"

import { useEffect, useRef } from "react"
import {
  buildConvaiDynamicVariables,
  resolveConvaiAgentId,
  type CareerConvaiSession,
} from "@/lib/voice/convai-session"
import { loadConvaiWidgetScript } from "@/lib/voice/load-convai-widget"
import { registerCareerConvaiWidget } from "@/lib/voice/convai-widget-control"
import { cn } from "@/lib/utils"
import "./career-convai-widget.css"

type ConvaiWidgetElement = HTMLElement & {
  startConversation?: () => void
  endConversation?: () => void
}

type CareerConvaiWidgetProps = {
  className?: string
  placement?: "floating" | "inline"
  session?: CareerConvaiSession | null
  autoStart?: boolean
}

function resolveServerLocation(session: CareerConvaiSession): string {
  const fromSession = session.serverLocation?.trim()
  if (fromSession) return fromSession
  const fromEnv = process.env.NEXT_PUBLIC_ELEVENLABS_SERVER_LOCATION?.trim()
  if (fromEnv) return fromEnv
  return "us"
}

function useRtcEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_ELEVENLABS_USE_RTC?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

function createWidgetElement(session: CareerConvaiSession): ConvaiWidgetElement {
  const el = document.createElement("elevenlabs-convai") as ConvaiWidgetElement
  const agentId = resolveConvaiAgentId(session)
  const dynamicVars = buildConvaiDynamicVariables(session)

  el.setAttribute("agent-id", agentId)
  el.setAttribute("server-location", resolveServerLocation(session))

  const useAuthUrl = Boolean(session.agentRequiresAuth && session.signedUrl)
  if (useAuthUrl) {
    el.setAttribute("signed-url", session.signedUrl!)
  } else if (useRtcEnabled()) {
    el.setAttribute("use-rtc", "true")
  }

  if (Object.keys(dynamicVars).length > 0) {
    el.setAttribute("dynamic-variables", JSON.stringify(dynamicVars))
  }

  if (session.userId) {
    el.setAttribute("user-id", session.userId)
  }

  el.setAttribute("action-text", "Juno CareerOS")
  el.setAttribute("start-call-text", "Start voice")
  el.setAttribute("end-call-text", "End voice")
  el.setAttribute("listening-text", "Your turn — speak anytime")
  el.setAttribute("speaking-text", "Juno is speaking")
  el.setAttribute("expand-text", "Open")
  el.setAttribute("collapse-text", "Close")
  el.setAttribute("disable-banner", "true")
  el.setAttribute("transcript", "true")
  el.setAttribute("text-input", "true")
  el.setAttribute("mic-muting", "true")

  return el
}
function applyPlacement(
  el: ConvaiWidgetElement,
  placement: "floating" | "inline",
  host: HTMLDivElement | null,
  rootRef: { current: HTMLDivElement | null },
) {
  if (placement === "floating") {
    el.setAttribute("variant", "compact")
    el.setAttribute("dismissible", "true")
    const root = document.createElement("div")
    root.className = "career-convai-floating-root"
    root.appendChild(el)
    document.body.appendChild(root)
    rootRef.current = root
  } else {
    el.setAttribute("variant", "expanded")
    el.setAttribute("dismissible", "false")
    host?.appendChild(el)
  }
}

export function CareerConvaiWidget({
  className,
  placement = "floating",
  session,
  autoStart = false,
}: CareerConvaiWidgetProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<ConvaiWidgetElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const sessionKey = session?.userId
    ? `${session.userId}:${(session.careerContextSnippet ?? "").length}`
    : null

  useEffect(() => {
    if (!sessionKey || !session?.agentId) return

    let cancelled = false
    const host = hostRef.current

    void (async () => {
      try {
        await loadConvaiWidgetScript()
      } catch (e) {
        console.error("[CareerConvaiWidget] script load failed", e)
        return
      }
      if (cancelled) return

      widgetRef.current?.remove()
      rootRef.current?.remove()

      const el = createWidgetElement(session)
      applyPlacement(el, placement, host, rootRef)

      widgetRef.current = el
      registerCareerConvaiWidget(el)

      if (autoStart && typeof el.startConversation === "function") {
        window.setTimeout(() => {
          if (!cancelled) el.startConversation?.()
        }, 400)
      }
    })()

    return () => {
      cancelled = true
      try {
        widgetRef.current?.endConversation?.()
      } catch {
        // ignore
      }
      widgetRef.current?.remove()
      widgetRef.current = null
      rootRef.current?.remove()
      rootRef.current = null
      registerCareerConvaiWidget(null)
    }
  }, [placement, autoStart, sessionKey, session])
  if (placement === "floating") {
    return null
  }

  return (
    <div
      ref={hostRef}
      className={cn("career-convai-widget-host", className)}
      aria-label="Juno CareerOS voice agent"
    />
  )
}

export function CareerConvaiFloating(
  props: Omit<CareerConvaiWidgetProps, "placement">,
) {
  return <CareerConvaiWidget placement="floating" autoStart={false} {...props} />
}
