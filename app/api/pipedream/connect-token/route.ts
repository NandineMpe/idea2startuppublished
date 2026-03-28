import { NextResponse } from "next/server"
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

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    return NextResponse.json({
      token: created.token,
      expiresAt: created.expiresAt instanceof Date ? created.expiresAt.toISOString() : created.expiresAt,
      connectLinkUrl: created.connectLinkUrl,
    })
  } catch (e) {
    console.error("[pipedream connect-token]", e)
    const message = e instanceof Error ? e.message : "Token creation failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
