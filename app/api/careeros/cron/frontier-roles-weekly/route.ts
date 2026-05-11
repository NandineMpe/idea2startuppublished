import { NextResponse } from "next/server"
import { refreshMarketFrontierRoleSnapshots } from "@/lib/careeros/market/frontier-roles"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function isAuthorised(request: Request): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const cronSecret = process.env.CRON_SECRET?.trim()
  const verifyToken = process.env.VERIFY_TOKEN?.trim()
  if (bearer && cronSecret && bearer === cronSecret) return true
  if (bearer && verifyToken && bearer === verifyToken) return true
  return request.headers.get("x-vercel-cron") != null
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await refreshMarketFrontierRoleSnapshots()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
