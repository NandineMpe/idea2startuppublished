/**
 * Diagnostic: GET `/api/careeros/_verify/sources/onet`
 *
 * Implemented under `[verify]/sources/onet` because Next.js treats `_`-prefixed
 * folders as private (not URL segments); `[verify]` captures `_verify` in the path.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function mask(s: string | undefined): string {
  if (!s) return "(missing)"
  if (s.length <= 4) return "•".repeat(s.length)
  return `${s.slice(0, 2)}${"•".repeat(s.length - 4)}${s.slice(-2)}`
}

export async function GET(
  request: Request,
  context: { params: Promise<{ verify: string }> },
) {
  const { verify } = await context.params
  if (verify !== "_verify") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  if (!token || token !== process.env.VERIFY_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rawUsername = process.env.ONET_USERNAME
  const rawPassword = process.env.ONET_PASSWORD

  const diagnostics = {
    username_present: !!rawUsername,
    password_present: !!rawPassword,
    username_masked: mask(rawUsername),
    password_masked: mask(rawPassword),
    username_length: rawUsername?.length ?? 0,
    password_length: rawPassword?.length ?? 0,
    username_has_whitespace_edges:
      !!rawUsername && rawUsername !== rawUsername.trim(),
    password_has_whitespace_edges:
      !!rawPassword && rawPassword !== rawPassword.trim(),
    username_has_newline: !!rawUsername && rawUsername.includes("\n"),
    password_has_newline: !!rawPassword && rawPassword.includes("\n"),
  }

  if (!rawUsername || !rawPassword) {
    return NextResponse.json({
      ok: false,
      stage: "env-check",
      diagnostics,
      hint:
        "ONET_USERNAME or ONET_PASSWORD missing. Verify both are set in Vercel for the current environment (Preview or Production).",
    })
  }

  const username = rawUsername.trim()
  const password = rawPassword.trim()

  const auth = Buffer.from(`${username}:${password}`).toString("base64")

  const targetUrl = "https://services.onetcenter.org/ws/about"

  let response: Response
  let bodyText: string
  try {
    response = await fetch(targetUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        "User-Agent": "CareerOS Diagnostic (contact: nano@augentik.com)",
      },
    })
    bodyText = await response.text()
  } catch (err) {
    return NextResponse.json({
      ok: false,
      stage: "fetch-error",
      diagnostics,
      target: targetUrl,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  let bodyParsed: unknown = null
  try {
    bodyParsed = JSON.parse(bodyText)
  } catch {
    bodyParsed = null
  }

  return NextResponse.json({
    ok: response.ok,
    stage: response.ok ? "success" : "auth-or-permission-failure",
    diagnostics,
    target: targetUrl,
    response_status: response.status,
    response_status_text: response.statusText,
    response_headers: {
      "content-type": response.headers.get("content-type"),
      "www-authenticate": response.headers.get("www-authenticate"),
    },
    response_body_parsed: bodyParsed,
    response_body_raw_first_500: bodyText.slice(0, 500),
    interpretation: interpretFailure(response.status, bodyText, diagnostics),
  })
}

function interpretFailure(
  status: number,
  body: string,
  diagnostics: Record<string, unknown>,
): string {
  if (status === 200) return "Auth working correctly."
  if (status === 401) {
    if (diagnostics.password_has_whitespace_edges || diagnostics.password_has_newline) {
      return "401 Unauthorized AND password has whitespace/newline characters in Vercel — strip these in Vercel env settings."
    }
    if (diagnostics.username_has_whitespace_edges || diagnostics.username_has_newline) {
      return "401 Unauthorized AND username has whitespace/newline characters in Vercel — strip these."
    }
    return "401 Unauthorized — credentials are wrong. Most common cause: typo in Vercel env. Check: (1) username matches the registration email exactly, (2) password is correct (try logging into services.onetcenter.org/developer/ to confirm)."
  }
  if (status === 403) {
    return "403 Forbidden — credentials valid but account may be suspended, missing User-Agent, or hitting a restricted endpoint."
  }
  if (status === 404) {
    return "404 — endpoint URL is wrong. Confirm we're hitting /ws/about."
  }
  if (status === 406) {
    return "406 Not Acceptable — Accept header missing or wrong. Should be application/json."
  }
  if (status >= 500) {
    return "5xx — O*NET service issue, not our problem. Retry in 5 minutes."
  }
  return `Unexpected ${status}. Read the response body for details.`
}
