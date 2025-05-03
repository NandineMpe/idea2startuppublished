"use client"

import { useUser } from "@clerk/nextjs"
import { useState, useEffect } from "react"
import type React from "react"
import { TopNavbar } from "@/components/dashboard/top-navbar"
import { DashboardSidebar } from "@/components/dashboard/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSignedIn, isLoaded } = useUser()

  // Start with sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  // Listen for sidebar collapse state changes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Check if mouse is near the left edge of the screen
      if (e.clientX < 16) {
        setSidebarCollapsed(false)
      } else if (e.clientX > 264) {
        setSidebarCollapsed(true)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      window.location.href = "/sign-in"
    }
  }, [isLoaded, isSignedIn])

  // Show loading or nothing while checking auth
  if (!isLoaded || !isSignedIn) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopNavbar />
      <div className="flex flex-1">
        <DashboardSidebar />
        <main className={`flex-1 p-6 transition-all duration-300 ${sidebarCollapsed ? "ml-16" : "ml-64"}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
