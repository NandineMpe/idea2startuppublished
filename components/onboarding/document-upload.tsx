"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

type Props = {
  onContinue: () => void
}

export function DocumentUpload({ onContinue }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("type", "document")
        const res = await fetch("/api/company/assets", {
          method: "POST",
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(typeof data.error === "string" ? data.error : "Upload failed")
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 pt-16 text-center">
      <h2 className="text-xl font-semibold tracking-tight">Knowledge captured</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload pitch decks, one-pagers, or notes. Text is extracted for agent context.
      </p>

      <label
        htmlFor="onboarding-doc-upload"
        className="mt-8 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-12 transition-colors hover:bg-muted/40"
      >
        <input
          id="onboarding-doc-upload"
          type="file"
          accept=".pdf,.doc,.docx,.md,.txt,.html,.csv"
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <span className="text-sm font-medium">Drop files here or click to upload</span>
        <span className="mt-1 text-xs text-muted-foreground">PDF, Word, Markdown, or plain text</span>
      </label>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={onContinue} disabled={uploading}>
          {uploading ? "Uploading…" : "Continue"}
        </Button>
        <Button type="button" variant="outline" onClick={onContinue} disabled={uploading}>
          Skip for now
        </Button>
      </div>
    </div>
  )
}
