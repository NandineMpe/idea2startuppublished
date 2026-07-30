"use client"

import { useCallback, useEffect, useState } from "react"
import { CareerConvaiFloating } from "@/components/careeros/career-convai-widget"
import type { CareerConvaiSession } from "@/lib/voice/convai-session"

async function fetchConvaiSession(): Promise<CareerConvaiSession | null> {
  try {
    const res = await fetch("/api/careeros/voice/session", {
      credentials: "include",
      cache: "no-store",
    })
    const data = (await res.json()) as CareerConvaiSession
    if (!res.ok) return null
    return data
  } catch {
    return null
  }
}

/** ElevenLabs floating ConvAI widget (official embed). */
export function CareerConvaiFloatingLoader() {
  const [session, setSession] = useState<CareerConvaiSession | null>(null)

  const refresh = useCallback(async () => {
    const data = await fetchConvaiSession()
    setSession(data)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!session?.agentId) return null

  return <CareerConvaiFloating session={session} />
}
