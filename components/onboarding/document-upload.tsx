"use client"

import { useState } from "react"
import { FileText, Upload, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

type Props = {
  onContinue: () => void
}

const LLM_INSTRUCTIONS = [
  {
    name: "Chat assistant",
    steps: [
      'Open a conversation with context about your startup.',
      'Type: "Summarise everything you know about my startup, product, and goals as a detailed markdown document."',
      "Copy the response, paste into a text editor, and save as a .md file.",
    ],
  },
  {
    name: "Another project or thread",
    steps: [
      "Open any project or conversation where you've shared company context.",
      'Ask: "Export a full markdown summary of my startup context — product, market, team, goals."',
      "Copy the response and save as a .md file.",
    ],
  },
  {
    name: "Notes or documents",
    steps: [
      "Open your strategy doc, pitch deck notes, or founder journal.",
      'Export as Markdown (.md) or plain text (.txt) from your notes app (use Export or Download).',
      "Upload the exported file below.",
    ],
  },
]

export function DocumentUpload({ onContinue }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openInstruction, setOpenInstruction] = useState<number | null>(null)

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    setUploading(true)
    const newNames: string[] = []
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
        newNames.push(file.name)
      }
      setUploaded((prev) => [...prev, ...newNames])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 pt-14 pb-24">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Setup
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">
        Upload your startup context
      </h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        Drop in any markdown, notes, or documents that describe your startup. Juno reads them so
        every agent starts with full context — no re-explaining needed.
      </p>

      {/* LLM export instructions */}
      <div className="mt-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          How to export context from another AI
        </p>
        {LLM_INSTRUCTIONS.map((item, i) => (
          <div
            key={item.name}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
              onClick={() => setOpenInstruction(openInstruction === i ? null : i)}
            >
              {item.name}
              {openInstruction === i ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {openInstruction === i && (
              <ol className="px-4 pb-4 space-y-2">
                {item.steps.map((step, j) => (
                  <li key={j} className="flex gap-3 text-sm text-muted-foreground leading-relaxed">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {j + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <label
        htmlFor="onboarding-doc-upload"
        className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-10 transition-colors hover:bg-muted/40"
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
        <Upload className="h-7 w-7 text-muted-foreground" />
        <span className="mt-3 text-sm font-medium">Drop files here or click to upload</span>
        <span className="mt-1 text-xs text-muted-foreground">
          Markdown, PDF, Word, plain text — any format works
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {uploaded.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {uploaded.map((name) => (
            <li key={name} className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4 text-primary" />
              {name}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button type="button" onClick={onContinue} disabled={uploading}>
          {uploading ? "Uploading…" : uploaded.length > 0 ? "Continue" : "Continue without uploading"}
        </Button>
      </div>
    </div>
  )
}
