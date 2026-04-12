"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, FileText, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type WorkspaceMeta = {
  id: string
  slug: string
  displayName: string
  companyName?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contextStatus: "draft" | "intake_started" | "ready"
}

type IntakeState = {
  contactName: string
  contactEmail: string
  founderName: string
  companyName: string
  websiteUrl: string
  companyDescription: string
  problem: string
  solution: string
  targetMarket: string
  businessModel: string
  traction: string
  differentiators: string
  contextNotes: string
  knowledgeBaseMd: string  // full LLM export / Obsidian md file content
}

const EMPTY_FORM: IntakeState = {
  contactName: "",
  contactEmail: "",
  founderName: "",
  companyName: "",
  websiteUrl: "",
  companyDescription: "",
  problem: "",
  solution: "",
  targetMarket: "",
  businessModel: "",
  traction: "",
  differentiators: "",
  contextNotes: "",
  knowledgeBaseMd: "",
}

export function SharedIntakeForm({ token }: { token: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<IntakeState>(EMPTY_FORM)

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [uploadedWordCount, setUploadedWordCount] = useState<number>(0)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError(null)

    const allowed = [".md", ".txt", ".markdown"]
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!allowed.includes(ext)) {
      setFileError("Only .md, .markdown, or .txt files are supported.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileError("File must be under 2 MB.")
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length
      setUploadedFileName(file.name)
      setUploadedWordCount(wordCount)
      updateField("knowledgeBaseMd", text)
    }
    reader.readAsText(file)
  }

  function clearFile() {
    setUploadedFileName(null)
    setUploadedWordCount(0)
    setFileError(null)
    updateField("knowledgeBaseMd", "")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const response = await fetch(`/api/public/workspace-intake/${token}`)
        if (response.status === 404) {
          if (!cancelled) setNotFound(true)
          return
        }

        const data = (await response.json()) as { workspace?: WorkspaceMeta; error?: string }
        if (!response.ok || !data.workspace) {
          throw new Error(data.error || "Could not load intake link")
        }

        if (cancelled) return

        setWorkspace(data.workspace)
        setForm((current) => ({
          ...current,
          contactName: data.workspace?.contactName || "",
          contactEmail: data.workspace?.contactEmail || "",
          companyName: data.workspace?.companyName || "",
        }))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load intake link")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  function updateField<K extends keyof IntakeState>(key: K, value: IntakeState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/public/workspace-intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Could not save your context")
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your context")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Link not found</CardTitle>
            <CardDescription>
              This intake link is no longer available. Ask the person who sent it to share a fresh one.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Could not load this intake</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-10">
        <Card className="w-full border-emerald-500/25 bg-emerald-500/5">
          <CardHeader>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <CardTitle>Context received</CardTitle>
            <CardDescription>
              Your company context has been saved. The Juno workspace owner can now generate tailored outputs for this business.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:py-16">
      <div className="mb-8 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Shared Juno Intake
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Add the company context for {workspace?.displayName || "this workspace"}.
        </h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          Fill this in once and Juno will shape it into a working company brief the owner can generate against.
          You do not need to make it perfect. Clear, concrete context beats polished marketing copy.
        </p>
      </div>

      <div className="space-y-6">

        {/* ── Full context document — TOP, primary path ── */}
        <Card>
          <CardHeader>
            <CardTitle>Upload your context document</CardTitle>
            <CardDescription>
              The fastest way to give Juno full context. Upload a markdown or text file and you're done — no need to fill in anything below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How to create this document</p>
              <ul className="space-y-1 list-none">
                <li>→ Open ChatGPT or Claude and paste: <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">"Summarise everything you know about my startup — product, market, team, goals — as a detailed markdown document."</span></li>
                <li>→ Copy the response, save as <span className="font-mono text-xs">context.md</span>, upload below.</li>
                <li>→ Or export directly from Notion, Obsidian, or any notes app as <span className="font-mono text-xs">.md</span> or <span className="font-mono text-xs">.txt</span>.</li>
              </ul>
            </div>

            {!uploadedFileName ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-colors px-6 py-10 flex flex-col items-center gap-3 text-center cursor-pointer"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Upload your context file</p>
                  <p className="text-xs text-muted-foreground mt-0.5">.md, .markdown, or .txt — max 2 MB</p>
                </div>
              </button>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{uploadedFileName}</p>
                    <p className="text-xs text-muted-foreground">{uploadedWordCount.toLocaleString()} words — Juno will use this as the primary knowledge base</p>
                  </div>
                </div>
                <button type="button" onClick={clearFile} className="text-muted-foreground hover:text-foreground ml-4">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {fileError && <p className="text-sm text-destructive">{fileError}</p>}

            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </CardContent>
        </Card>

        {/* ── Manual fields — only shown when no file uploaded ── */}
        {!uploadedFileName && (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <p className="text-xs text-muted-foreground shrink-0">or fill in manually</p>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Who should we anchor this to?</CardTitle>
                <CardDescription>Basic contact details help us keep the context grounded.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Input placeholder="Your name" value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} />
                <Input type="email" placeholder="you@company.com" value={form.contactEmail} onChange={(e) => updateField("contactEmail", e.target.value)} />
                <Input placeholder="Founder / lead name" value={form.founderName} onChange={(e) => updateField("founderName", e.target.value)} />
                <Input placeholder="Company name" value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Company basics</CardTitle>
                <CardDescription>A website is optional, but useful. The richer fields below matter more.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input type="url" placeholder="https://company.com" value={form.websiteUrl} onChange={(e) => updateField("websiteUrl", e.target.value)} />
                <Textarea className="min-h-[120px]" placeholder="What does the company do? Give the clearest plain-English description you can." value={form.companyDescription} onChange={(e) => updateField("companyDescription", e.target.value)} />
                <Textarea className="min-h-[120px]" placeholder="What problem are you solving, and for whom?" value={form.problem} onChange={(e) => updateField("problem", e.target.value)} />
                <Textarea className="min-h-[120px]" placeholder="What is the product or service? How does it solve the problem?" value={form.solution} onChange={(e) => updateField("solution", e.target.value)} />
                <Textarea className="min-h-[110px]" placeholder="Who is the target customer? Title, company type, buyer, or end user." value={form.targetMarket} onChange={(e) => updateField("targetMarket", e.target.value)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commercial context</CardTitle>
                <CardDescription>These details make the generated output feel specific instead of generic.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea className="min-h-[100px]" placeholder="How does the business make money?" value={form.businessModel} onChange={(e) => updateField("businessModel", e.target.value)} />
                <Textarea className="min-h-[100px]" placeholder="Any traction so far? Revenue, customers, pilots, growth, proof points." value={form.traction} onChange={(e) => updateField("traction", e.target.value)} />
                <Textarea className="min-h-[100px]" placeholder="What makes you meaningfully different from alternatives?" value={form.differentiators} onChange={(e) => updateField("differentiators", e.target.value)} />
                <Textarea className="min-h-[140px]" placeholder="Anything else Juno should know? Priorities, risks, competitors, founder background, vocabulary, constraints." value={form.contextNotes} onChange={(e) => updateField("contextNotes", e.target.value)} />
              </CardContent>
            </Card>
          </>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving context</>
            ) : (
              "Save company context"
            )}
          </Button>
          <p className="text-sm text-muted-foreground">
            We will turn this into a usable workspace brief, not publish it anywhere.
          </p>
        </div>
      </div>
    </div>
  )
}
