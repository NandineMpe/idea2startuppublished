"use client"

import { useEffect } from "react"

export function AnalyticsTracker() {
  useEffect(() => {
    // Call the analytics endpoint to set the user ID cookie
    fetch("/api/analytics").catch(console.error)
  }, [])

  return null // This component doesn't render anything
}
