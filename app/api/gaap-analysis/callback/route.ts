import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import {
  N8N_WEBHOOK_SIGNATURE_HEADER,
  verifyN8nWebhookSignature,
} from "@/lib/n8n-webhook-signature"
import { supabaseAdmin } from "@/lib/supabase"

export const maxDuration = 60

/**
 * POST /api/gaap-analysis/callback — n8n webhook that completes a GAAP analysis job.
 * Set `GAAP_ANALYSIS_WEBHOOK_SECRET` (or `N8N_WEBHOOK_SECRET`) and configure n8n to sign the
 * raw JSON body with HMAC-SHA256 using that secret, and send the hex digest in `x-webhook-signature`
 * (optionally `sha256=<hex>`). Same signing rules as `/api/comparable-companies/callback`.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const secret =
      process.env.GAAP_ANALYSIS_WEBHOOK_SECRET?.trim() ??
      process.env.N8N_WEBHOOK_SECRET?.trim()
    if (!secret) {
      console.error(
        "[gaap-analysis/callback] GAAP_ANALYSIS_WEBHOOK_SECRET or N8N_WEBHOOK_SECRET is not set",
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

    const findings = Array.isArray(body.findings) ? body.findings : []
    const totalItems = typeof body.totalItems === "number" ? body.totalItems : undefined
    const totalApplicable = typeof body.totalApplicable === "number" ? body.totalApplicable : undefined
    const totalNotApplicable =
      typeof body.totalNotApplicable === "number" ? body.totalNotApplicable : undefined
    const status = typeof body.status === "string" ? body.status : "completed"
    const errorMsg = typeof body.error === "string" ? body.error : null

    const { error: updateError } = await supabaseAdmin
      .from("gaap_analysis_results")
      .update({
        status: status || "completed",
        findings: findings || [],
        ...(totalItems !== undefined ? { total_items: totalItems } : {}),
        ...(totalApplicable !== undefined ? { total_applicable: totalApplicable } : {}),
        ...(totalNotApplicable !== undefined ? { total_not_applicable: totalNotApplicable } : {}),
        ...(errorMsg !== null ? { error: errorMsg } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId)

    if (updateError) {
      console.error("[gaap-analysis/callback] update failed", updateError)
      return jsonApiError(500, updateError, "gaap-analysis callback")
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return jsonApiError(500, e, "gaap-analysis callback")
  }
}
