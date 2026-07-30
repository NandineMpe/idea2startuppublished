"use client"

import "@/app/careeros-prototype.css"
import { usePathname } from "next/navigation"
import { CareerConvaiFloatingLoader } from "@/components/careeros/career-convai-floating-loader"
import { CareerSidebar } from "@/components/dashboard/career-sidebar"
import { CareerTopNavbar } from "@/components/dashboard/career-top-navbar"
import { startCareerConvaiConversation } from "@/lib/voice/convai-widget-control"

export function CareerOsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ""
  const isOnboarding = pathname.startsWith("/careeros/onboarding")

  if (isOnboarding) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground">{children}</div>
    )
  }

  return (
    <div className="career-os-shell min-h-screen w-full bg-background text-foreground">
      <div className="app-shell grid h-screen w-full grid-cols-[240px_minmax(0,1fr)] overflow-hidden">
        <CareerSidebar />
        <main className="main flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CareerTopNavbar onOpenBrainChat={() => startCareerConvaiConversation()} />
          <div className="page box-border w-full max-w-[1280px] flex-1 overflow-x-hidden overflow-y-auto px-6 py-8 md:px-10 md:py-8">
            {children}
          </div>
        </main>
      </div>
      <CareerConvaiFloatingLoader />
    </div>
  )
}
