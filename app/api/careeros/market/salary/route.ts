import { NextResponse } from "next/server"
import { getSalaryBandsForUser } from "@/lib/careeros/market/salary-bands"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await getSalaryBandsForUser(user.id)
  return NextResponse.json(payload)
}
