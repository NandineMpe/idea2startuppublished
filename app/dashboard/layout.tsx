import type React from "react"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = auth()

  if (!userId) {
    redirect("/auth")
  }

  return <div>{children}</div>
}
