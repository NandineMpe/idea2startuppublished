import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { checkAndIncrementApiRateLimit } from "@/lib/api-rate-limit"
import { createClient } from "@/lib/supabase/server"

const RATE_FEATURE = "comparable_companies"
const MAX_ANALYSES_PER_HOUR = 5
const WINDOW_SECONDS = 3600

function buildPrompt(companyName: string, companyWebsite: string) {
  const site = companyWebsite?.trim() || "website not provided"
  const name = companyName?.trim() || "Unknown company"
  return `Find comparable companies for: ${name}. Official or primary site: ${site}.

Return structured findings: list 5 to 10 companies that are most comparable (model, stage, geography, ICP). For each, give a one line rationale.`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    let body: { companyName?: string; companyWebsite?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const companyName = typeof body.companyName === "string" ? body.companyName : ""
    const companyWebsite = typeof body.companyWebsite === "string" ? body.companyWebsite : ""

    if (!companyName.trim()) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 })
    }

    let rate: Awaited<ReturnType<typeof checkAndIncrementApiRateLimit>>
    try {
      rate = await checkAndIncrementApiRateLimit(
        user.id,
        RATE_FEATURE,
        MAX_ANALYSES_PER_HOUR,
        WINDOW_SECONDS,
      )
    } catch (e) {
      return jsonApiError(503, e, "comparable-companies rate limit")
    }

    if (rate.allowed && rate.count >= MAX_ANALYSES_PER_HOUR - 1) {
      console.warn("[comparable-companies] usage near hourly cap", {
        userId: user.id,
        count: rate.count,
        limit: rate.limit,
      })
    }

    if (!rate.allowed) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((rate.resetAt.getTime() - Date.now()) / 1000),
      )
      console.warn("[comparable-companies] rate limit exceeded", {
        userId: user.id,
        count: rate.count,
        limit: rate.limit,
      })
      return NextResponse.json(
        {
          error: "Too many comparable company analyses. Try again later.",
          limit: rate.limit,
          count: rate.count,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        },
      )
    }

    const manusApiKey = process.env.MANUS_API_KEY?.trim()
    if (!manusApiKey) {
      return NextResponse.json(
        { error: "Comparable companies is not configured." },
        { status: 503 },
      )
    }

    const prompt = buildPrompt(companyName, companyWebsite)

    const response = await fetch("https://api.manus.ai/v1/agent/run", {
      method: "POST",
      headers: {
        API_KEY: manusApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: "comparable-discovery",
        inputs: { prompt },
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.error("[comparable-companies] Manus error", response.status, text.slice(0, 500))
      return jsonApiError(
        response.status >= 500 ? 502 : 502,
        new Error(`Manus request failed: ${response.status}`),
        "comparable-companies manus",
      )
    }

    const payload = await response.json().catch(() => null)
    if (!payload) {
      return jsonApiError(502, new Error("Invalid Manus response"), "comparable-companies parse")
    }

    return NextResponse.json(payload)
  } catch (e) {
    return jsonApiError(500, e, "comparable-companies")
  }
}
