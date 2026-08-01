import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CreatorSidebar } from "@/components/dashboard/creator-sidebar"
import { CreatorTopNavbar } from "@/components/dashboard/creator-top-navbar"
import { CreatorMobileNav } from "@/components/dashboard/creator-mobile-nav"

export default async function CreatorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/creator")
  }

  return (
    // dvh, not vh: on mobile browsers 100vh is the height with the URL bar
    // hidden, so a vh-based shell is permanently taller than the visible area
    // and the last rows of every screen sit under the chrome.
    <div className="flex h-[100dvh] bg-background text-foreground">
      <CreatorSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CreatorTopNavbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          {children}
          {/* Clears the fixed bottom bar, plus the home indicator on a phone
              with no physical button. Without it the last card is unreachable. */}
          <div className="h-[calc(3.5rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden />
        </main>
      </div>
      <CreatorMobileNav />
    </div>
  )
}
