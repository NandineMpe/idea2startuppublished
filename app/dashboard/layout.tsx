import { redirect } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { TopNavbar } from "@/components/dashboard/top-navbar"
import FloatingJuno from "@/components/floating-juno"
import { OnboardingGate } from "@/components/dashboard/onboarding-gate"
import { createClient } from "@/lib/supabase/server"
import { getBillingAccountForUser, isBillingAccessActive } from "@/lib/payments/access"
import { getLemonSqueezySettings } from "@/lib/payments/lemonsqueezy"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const settings = getLemonSqueezySettings()
  if (settings.enabled) {
    const billing = await getBillingAccountForUser(user.id)
    if (!isBillingAccessActive(billing)) {
      redirect("/paywall")
    }
  }

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
