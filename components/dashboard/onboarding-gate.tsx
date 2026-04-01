"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Sends users without a filled company profile to voice onboarding.
 * Only wraps /dashboard — avoids redirect loops with /onboarding.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [renderChildren, setRenderChildren] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/company/profile?scope=owner", { credentials: "include" })
        const data = (await res.json()) as { profile?: { company_name?: string | null } | null }
        if (cancelled) return
        const name = data.profile?.company_name?.trim()
        if (!name) {
          router.replace("/onboarding")
          return
        }
        setRenderChildren(true)
      } catch {
        if (!cancelled) setRenderChildren(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!renderChildren) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}
