import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import { persistTextDocument } from "@/lib/careeros/documents/persist-user-document"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_CHARS = 120_000

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      linkedinText?: unknown
    }

    const linkedinText =
      typeof body.linkedinText === "string" ? body.linkedinText.trim() : ""

    if (linkedinText.length > MAX_CHARS) {
      return NextResponse.json({ error: "LinkedIn text too long" }, { status: 400 })
    }

    let documentId: string | undefined
    let deduped = false

    if (linkedinText.length > 0) {
      const persisted = await persistTextDocument({
        userId: user.id,
        docType: "linkedin",
        plainText: linkedinText,
        contentType: "text/plain",
        parserName: "careeros-onboarding",
        parserVersion: "1",
        fileExtension: "txt",
      })
      documentId = persisted.documentId
      deduped = persisted.deduped
    }

    await mergeCareerOsOnboardingState(user.id, {
      step2CompletedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      ok: true,
      linkedin: linkedinText.length > 0 ? { documentId, deduped } : null,
      skipped: linkedinText.length === 0,
    })
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding step-two")
  }
}
