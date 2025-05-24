"use client"

import type React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { TopNavbar } from "@/components/dashboard/top-navbar"
import { Preloader } from "@/components/preloader"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (status === "unauthenticated") {
      router.push("/auth/signin")
      return
    }
  }, [status, router])

  if (status === "loading") {
    return <Preloader />
  }

  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="flex h-screen flex-col bg-black">
      <TopNavbar />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar />
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-black transition-all duration-300">{children}</main>
      </div>
    </div>
  )
}
