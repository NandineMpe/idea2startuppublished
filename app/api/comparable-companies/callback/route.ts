import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import {
  N8N_WEBHOOK_SIGNATURE_HEADER,
  verifyN8nWebhookSignature,
} from "@/lib/n8n-webhook-signature"
import { supabaseAdmin } from "@/lib/supabase"

export const maxDuration = 60

/**
 * POST /api/comparable-companies/callback — n8n webhook that completes a comparable companies job.
 * Set `COMPARABLE_COMPANIES_WEBHOOK_SECRET` (or `N8N_WEBHOOK_SECRET`) and configure n8n to sign the
 * raw JSON body with HMAC-SHA256 using that secret, and send the hex digest in `x-webhook-signature`
 * (optionally `sha256=<hex>`).
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const secret =
      process.env.COMPARABLE_COMPANIES_WEBHOOK_SECRET?.trim() ??
      process.env.N8N_WEBHOOK_SECRET?.trim()
    if (!secret) {
      console.error(
        "[comparable-companies/callback] COMPARABLE_COMPANIES_WEBHOOK_SECRET or N8N_WEBHOOK_SECRET is not set",
      )
      return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 })
    }

    const signature = request.headers.get(N8N_WEBHOOK_SIGNATURE_HEADER)
    if (!verifyN8nWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : ""
    if (!jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 })
    }

    const companyName = typeof body.companyName === "string" ? body.companyName : null
    const comparables = Array.isArray(body.comparables) ? body.comparables : []
    const status = typeof body.status === "string" ? body.status : "completed"
    const errorMsg = typeof body.error === "string" ? body.error : null

    const { error: updateError } = await supabaseAdmin
      .from("comparable_companies_results")
      .update({
        status: status || "completed",
        ...(companyName !== null ? { company_name: companyName } : {}),
        comparables,
        ...(errorMsg !== null ? { error: errorMsg } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)

    if (updateError) {
      console.error("[comparable-companies/callback] update failed", updateError)
      return jsonApiError(500, updateError, "comparable-companies callback")
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonApiError(500, e, "comparable-companies callback")
  }
}
