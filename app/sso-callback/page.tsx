"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useClerk } from "@clerk/nextjs"

export default function SSOCallback() {
  const { handleRedirectCallback } = useClerk()
  const router = useRouter()

  useEffect(() => {
    async function processCallback() {
      try {
        await handleRedirectCallback({
          redirectUrl: "/dashboard",
        })
        router.push("/dashboard")
      } catch (error) {
        console.error("Error handling redirect callback:", error)
        router.push("/auth")
      }
    }

    processCallback()
  }, [handleRedirectCallback, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-2xl font-bold text-white">Completing authentication...</h1>
        <p className="text-white/60">You'll be redirected to the dashboard shortly</p>
      </div>
    </div>
  )
}
