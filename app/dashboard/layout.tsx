import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar"
import { TopNavbar } from "@/components/dashboard/top-navbar"
import FloatingJuno from "@/components/floating-juno"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-black text-white selection:bg-primary/30">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNavbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-black text-white custom-scrollbar transition-all duration-500 ease-in-out">
          {children}
        </main>
      </div>
      <FloatingJuno />
    </div>
  )
}
