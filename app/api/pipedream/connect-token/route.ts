import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { PipedreamClient } from "@pipedream/sdk"
import { createClient } from "@/lib/supabase/server"
import { getPipedreamProjectEnvironment } from "@/lib/pipedream-connect-env"

function pushOrigin(into: Set<string>, value: string | null | undefined) {
  if (!value) return
  try {
    const origin = new URL(value).origin
    if (origin.startsWith("http://") || origin.startsWith("https://")) {
      into.add(origin)
    }
  } catch {
    /* ignore invalid origins */
  }
}

function allowedOrigins(req: Request): string[] {
  const out = new Set<string>()
  const raw = process.env.PIPEDREAM_ALLOWED_ORIGINS?.trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        for (const value of parsed) {
          pushOrigin(out, value)
        }
      }
    } catch {
      /* use fallbacks */
    }
  }

  pushOrigin(out, process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, ""))

  const vercel = process.env.VERCEL_URL
  if (vercel) pushOrigin(out, `https://${vercel}`)

  const requestOrigin = new URL(req.url).origin
  pushOrigin(out, requestOrigin)
  pushOrigin(out, req.headers.get("origin"))

  const forwardedHost = req.headers.get("x-forwarded-host")
  const forwardedProto = req.headers.get("x-forwarded-proto")
  if (forwardedHost && forwardedProto) {
    pushOrigin(out, `${forwardedProto}://${forwardedHost}`)
  }

  pushOrigin(out, "http://localhost:3000")
  return [...out]
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
      allowedOrigins: allowedOrigins(req),
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
