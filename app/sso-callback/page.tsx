"use client"

import { useEffect } from "react"
import { useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function SSOCallbackPage() {
  const { handleRedirectCallback } = useClerk()
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        await handleRedirectCallback()
        router.push("/dashboard")
      } catch (err) {
        console.error("SSO callback error:", err)
        router.push("/auth?error=sso_failed")
      }
    }

    handleCallback()
  }, [handleRedirectCallback, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-white/60">Completing sign in...</p>
      </div>
    </div>
  )
}
