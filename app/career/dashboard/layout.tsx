import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CareerSidebar } from "@/components/dashboard/career-sidebar"
import { CareerTopNavbar } from "@/components/dashboard/career-top-navbar"

export default async function CareerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/career")
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <CareerSidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <CareerTopNavbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  )
}
