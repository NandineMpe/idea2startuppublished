import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { PipedreamClient } from "@pipedream/sdk"
import { createClient } from "@/lib/supabase/server"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"
import { pickMostRecentGithubAccount, GITHUB_ACCOUNTS_LIST_LIMIT } from "@/lib/juno/pipedream-github"
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
 * Returns the **latest** Connect account for the app (by createdAt), not the full duplicate history.
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
      limit: GITHUB_ACCOUNTS_LIST_LIMIT,
    })
    const latest = pickMostRecentGithubAccount(page.data ?? [])
    const accounts = latest ? [serializePipedreamAccount(latest)] : []
    return NextResponse.json({ accounts })
  } catch (e) {
    return jsonApiError(502, e, "pipedream accounts GET")
  }
}
