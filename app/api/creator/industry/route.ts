import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { refreshIndustry } from "@/lib/creator/industry/build"

export const runtime = "nodejs"
// She is waiting on this one, and it is a reasoning pass over sixty indexed
// signals, so it runs inline with headroom rather than queueing through Inngest.
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { slug?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.slug) return NextResponse.json({ error: "slug is required" }, { status: 400 })

  const result = await refreshIndustry(supabase, user.id, body.slug)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ ok: true, tokens: result.tokens })
}
