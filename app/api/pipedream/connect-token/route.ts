import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { PipedreamClient } from "@pipedream/sdk"
import { createClient } from "@/lib/supabase/server"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"

function allowedOrigins(): string[] {
  const raw = process.env.PIPEDREAM_ALLOWED_ORIGINS?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed
      }
    } catch {
      /* use fallbacks */
    }
  }
  const out: string[] = []
  const app = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")
  if (app) out.push(app)
  const vercel = process.env.VERCEL_URL
  if (vercel) out.push(`https://${vercel}`)
  out.push("http://localhost:3000")
  return [...new Set(out)]
}

type Body = {
  externalUserId?: string
  external_user_id?: string
}

/**
 * Mints a Connect token for the **signed-in** Supabase user.
 * Body may include `externalUserId` (or `external_user_id`) — it must match `user.id`
 * so the token is scoped to the same ID the browser SDK uses in `createFrontendClient`.
 */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as Body
  const requestedExternalId = (body.externalUserId ?? body.external_user_id)?.trim()
  if (requestedExternalId && requestedExternalId !== user.id) {
    return NextResponse.json(
      {
        error:
          "externalUserId does not match the signed-in user. Refresh the page and try Connect again.",
      },
      { status: 403 },
    )
  }

  const clientId = process.env.PIPEDREAM_CLIENT_ID
  const clientSecret = process.env.PIPEDREAM_CLIENT_SECRET
  const projectId = process.env.PIPEDREAM_PROJECT_ID
  if (!clientId || !clientSecret || !projectId) {
    return NextResponse.json(
      { error: "Pipedream is not configured (PIPEDREAM_CLIENT_ID, PIPEDREAM_CLIENT_SECRET, PIPEDREAM_PROJECT_ID)" },
      { status: 503 },
    )
  }

  const client = new PipedreamClient({
    clientId,
    clientSecret,
    projectId,
    projectEnvironment: getPipedreamProjectEnvironment(),
  })

  try {
    const created = await client.tokens.create({
      externalUserId: user.id,
      allowedOrigins: allowedOrigins(),
    })
    /** When set, Connect must use your BYO GitHub OAuth client (Pipedream → Accounts → OAuth Clients). */
    const githubOauthAppId = process.env.PIPEDREAM_GITHUB_OAUTH_APP_ID?.trim() || undefined

    return NextResponse.json({
      token: created.token,
      expiresAt: created.expiresAt instanceof Date ? created.expiresAt.toISOString() : created.expiresAt,
      connectLinkUrl: created.connectLinkUrl,
      githubOauthAppId,
      externalUserId: user.id,
    })
  } catch (e) {
    return jsonApiError(502, e, "pipedream connect-token POST")
  }
}
