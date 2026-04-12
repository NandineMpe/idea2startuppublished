import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCompanyContext } from "@/lib/company-context"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ context: "" })
    }

    const ctx = await getCompanyContext(user.id, { useCookieWorkspace: true })
    const context = ctx?.promptBlock ?? ""

    return NextResponse.json({
      context: context || "No company profile set. Fill in Context to enable all agents.",
    })
  } catch (error) {
    console.error("Company context GET error:", error)
    return NextResponse.json({ context: "" }, { status: 500 })
  }
}
