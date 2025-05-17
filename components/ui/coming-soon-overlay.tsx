"use client"

import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"

interface ComingSoonOverlayProps {
  title?: string
  description?: string
  showRequestAccess?: boolean
}

export function ComingSoonOverlay({
  title = "Coming Soon",
  description = "We're working hard to bring you this feature. Stay tuned!",
  showRequestAccess = true,
}: ComingSoonOverlayProps) {
  const pathname = usePathname()

  // Only exclude the specific pages mentioned by the user
  const excludedPaths = [
    "/dashboard",
    "/dashboard/knowledge/founders-journey",
    "/dashboard/knowledge/domain",
    "/dashboard/knowledge/feedback",
    "/dashboard/idea/analyser",
    "/dashboard/idea/market-insights",
    "/dashboard/idea/competitor-analysis",
    "/dashboard/market/strategy",
    "/dashboard/pitch",
    "/dashboard/settings",
  ]

  // Check if the current path is in the excluded paths list
  const shouldShowOverlay = !excludedPaths.includes(pathname)

  if (!shouldShowOverlay) {
    return null
  }

  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="max-w-md text-center p-6">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-white/70 mb-6">{description}</p>
        {showRequestAccess && (
          <Button className="bg-primary hover:bg-primary/90 text-black">Request Early Access</Button>
        )}
      </div>
    </div>
  )
}
