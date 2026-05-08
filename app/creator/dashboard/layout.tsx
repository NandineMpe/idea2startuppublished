import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CreatorSidebar } from "@/components/dashboard/creator-sidebar"
import { CreatorTopNavbar } from "@/components/dashboard/creator-top-navbar"

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
    <div className="flex h-screen bg-background text-foreground">
      <CreatorSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CreatorTopNavbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  )
}
