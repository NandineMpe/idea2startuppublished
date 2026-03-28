import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGithubAccountId, githubProxyGetJsonResult } from "@/lib/juno/pipedream-github"

/**
 * Live check: can we call GitHub /user with the Connect-linked account?
 * Returns verifiedAt (server time) and GitHub login when successful.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accountId = await getGithubAccountId(user.id)
  const verifiedAt = new Date().toISOString()

  if (!accountId) {
    return NextResponse.json({
      ok: false,
      error: "No GitHub account linked in Pipedream. Connect under Integrations first.",
      verifiedAt,
    })
  }

  const res = await githubProxyGetJsonResult<{ login?: string; id?: number }>(
    user.id,
    accountId,
    "https://api.github.com/user",
  )

  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      error: res.error,
      verifiedAt,
    })
  }

  const u = res.data as { login?: string; id?: number }
  return NextResponse.json({
    ok: true,
    githubLogin: typeof u.login === "string" ? u.login : null,
    githubUserId: typeof u.id === "number" ? u.id : null,
    verifiedAt,
  })
}
