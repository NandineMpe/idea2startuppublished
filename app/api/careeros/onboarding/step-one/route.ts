import { NextResponse } from "next/server"
import { jsonApiError } from "@/lib/api-error-response"
import { createClient } from "@/lib/supabase/server"
import {
  persistPdfResume,
  persistTextDocument,
} from "@/lib/careeros/documents/persist-user-document"
import { mergeCareerOsOnboardingState } from "@/lib/careeros/onboarding/user-settings"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_MD_BYTES = 2 * 1024 * 1024
const MAX_TEXT_CHARS = 120_000

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const contentType = request.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 },
      )
    }

    const form = await request.formData()

    const resumePdf = form.get("resumePdf")
    const resumeTextRaw = str(form.get("resumeText")).trim()
    const llmMarkdownFile = form.get("llmMarkdownFile")
    const llmMarkdownTextRaw = str(form.get("llmMarkdownText")).trim()

    const hasPdf =
      resumePdf instanceof File && resumePdf.size > 0 && resumePdf.name.length > 0
    const hasResumeText = resumeTextRaw.length > 0
    const hasMdFile =
      llmMarkdownFile instanceof File &&
      llmMarkdownFile.size > 0 &&
      llmMarkdownFile.name.length > 0
    const hasMdText = llmMarkdownTextRaw.length > 0

    if (!hasPdf && !hasResumeText && !hasMdFile && !hasMdText) {
      return NextResponse.json(
        {
          error:
            "Provide at least one of: resume PDF, resume text, LLM markdown file, or LLM markdown paste.",
        },
        { status: 400 },
      )
    }

    if (resumeTextRaw.length > MAX_TEXT_CHARS || llmMarkdownTextRaw.length > MAX_TEXT_CHARS) {
      return NextResponse.json({ error: "Text exceeds maximum length" }, { status: 400 })
    }

    const result: {
      resumePdf?: { documentId: string; deduped: boolean }
      resumeText?: { documentId: string; deduped: boolean }
      llmMarkdownFile?: { documentId: string; deduped: boolean }
      llmMarkdownPaste?: { documentId: string; deduped: boolean }
    } = {}

    if (hasPdf) {
      const file = resumePdf as File
      if (file.size > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "Resume PDF too large (max 10MB)" }, { status: 400 })
      }
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        return NextResponse.json({ error: "Resume file must be a PDF" }, { status: 400 })
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const persisted = await persistPdfResume({
        userId: user.id,
        buffer: buf,
        filename: file.name,
      })
      result.resumePdf = {
        documentId: persisted.documentId,
        deduped: persisted.deduped,
      }
    }

    if (hasResumeText) {
      const persisted = await persistTextDocument({
        userId: user.id,
        docType: "resume",
        plainText: resumeTextRaw,
        contentType: "text/plain",
        parserName: "careeros-onboarding",
        parserVersion: "1",
        fileExtension: "txt",
      })
      result.resumeText = {
        documentId: persisted.documentId,
        deduped: persisted.deduped,
      }
    }

    if (hasMdFile) {
      const file = llmMarkdownFile as File
      if (file.size > MAX_MD_BYTES) {
        return NextResponse.json({ error: "Markdown file too large (max 2MB)" }, { status: 400 })
      }
      const lower = file.name.toLowerCase()
      if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) {
        return NextResponse.json(
          { error: "LLM export must be a .md or .markdown file" },
          { status: 400 },
        )
      }
      const buf = Buffer.from(await file.arrayBuffer())
      const text = buf.toString("utf8")
      const persisted = await persistTextDocument({
        userId: user.id,
        docType: "llm_markdown",
        plainText: text,
        contentType: "text/markdown",
        parserName: "careeros-onboarding",
        parserVersion: "1",
        fileExtension: "md",
      })
      result.llmMarkdownFile = {
        documentId: persisted.documentId,
        deduped: persisted.deduped,
      }
    }

    if (hasMdText) {
      const persisted = await persistTextDocument({
        userId: user.id,
        docType: "llm_markdown",
        plainText: llmMarkdownTextRaw,
        contentType: "text/markdown",
        parserName: "careeros-onboarding",
        parserVersion: "1",
        fileExtension: "md",
      })
      result.llmMarkdownPaste = {
        documentId: persisted.documentId,
        deduped: persisted.deduped,
      }
    }

    await mergeCareerOsOnboardingState(user.id, {
      step1CompletedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, documents: result })
  } catch (error) {
    return jsonApiError(500, error, "careeros onboarding step-one")
  }
}
