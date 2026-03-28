import { NextResponse } from "next/server"
import { PipedreamClient } from "@pipedream/sdk"
import { createClient } from "@/lib/supabase/server"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"
import { serializePipedreamAccount } from "@/lib/pipedream-serialize-account"

function getServerClient(): PipedreamClient | null {
  const clientId = process.env.PIPEDREAM_CLIENT_ID
  const clientSecret = process.env.PIPEDREAM_CLIENT_SECRET
  const projectId = process.env.PIPEDREAM_PROJECT_ID
  if (!clientId || !clientSecret || !projectId) return null
  return new PipedreamClient({
    clientId,
    clientSecret,
    projectId,
    projectEnvironment: getPipedreamProjectEnvironment(),
  })
}

/**
 * Lists Pipedream Connect accounts for the signed-in user (server-side, correct project id).
 * The browser SDK hardcodes an empty projectId for accounts.list, which returns 404 — use this instead.
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const pd = getServerClient()
  if (!pd) {
    return NextResponse.json({ error: "Pipedream is not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const app = searchParams.get("app")?.trim() || "github"

  try {
    const page = await pd.accounts.list({
      externalUserId: user.id,
      app,
      limit: 50,
    })
    const accounts = (page.data ?? []).map((a) => serializePipedreamAccount(a))
    return NextResponse.json({ accounts })
  } catch (e) {
    console.error("[pipedream accounts]", e)
    const message = e instanceof Error ? e.message : "accounts.list failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
