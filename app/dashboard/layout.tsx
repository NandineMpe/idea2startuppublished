"use client"

import { useUser } from "@clerk/nextjs"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type React from "react"
import { TopNavbar } from "@/components/dashboard/top-navbar"
import { DashboardSidebar } from "@/components/dashboard/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isSignedIn, isLoaded } = useUser()
  const router = useRouter()

  // Start with sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

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

  // Handle authentication check
  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        router.push("/sign-in")
      } else {
        setIsLoading(false)
      }
    }
  }, [isLoaded, isSignedIn, router])

  // Show loading state while checking auth
  if (!isLoaded || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="text-primary text-xl">Loading...</div>
      </div>
    )
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
