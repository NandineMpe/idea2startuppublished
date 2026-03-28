import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { TopNavbar } from "@/components/dashboard/top-navbar"
import FloatingJuno from "@/components/floating-juno"
import { OnboardingGate } from "@/components/dashboard/onboarding-gate"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopNavbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          <OnboardingGate>{children}</OnboardingGate>
        </main>
      </div>
      <FloatingJuno />
    </div>
  )
}
