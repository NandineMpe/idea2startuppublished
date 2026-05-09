"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type Step = 1 | 2 | 3 | "building"

export function CareerOsOnboardingWizard() {
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)

  const [resumeText, setResumeText] = useState("")
  const [linkedinText, setLinkedinText] = useState("")
  const [llmMarkdownPaste, setLlmMarkdownPaste] = useState("")
  const [currentRole, setCurrentRole] = useState("")
  const [targetRole, setTargetRole] = useState("")
  const [locationLabel, setLocationLabel] = useState("")
  const [yearsExperience, setYearsExperience] = useState("")
  const [mergeLlmToBrain, setMergeLlmToBrain] = useState(true)

  async function submitStepOne(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setBusy(true)
    try {
      const form = ev.currentTarget
      const fd = new FormData()
      const pdfEl = form.elements.namedItem("resumePdf") as HTMLInputElement | null
      if (pdfEl?.files?.[0]) fd.append("resumePdf", pdfEl.files[0])
      fd.append("resumeText", resumeText)
      fd.append("llmMarkdownText", llmMarkdownPaste)
      const mdEl = form.elements.namedItem("llmMarkdownFile") as HTMLInputElement | null
      if (mdEl?.files?.[0]) fd.append("llmMarkdownFile", mdEl.files[0])
      const res = await fetch("/api/careeros/onboarding/step-one", {
        method: "POST",
        body: fd,
        credentials: "include",
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error || "Could not save documents")
        return
      }
      toast.success("Step 1 saved")
      setStep(2)
    } finally {
      setBusy(false)
    }
  }

  async function submitStepTwo(ev: React.FormEvent) {
    ev.preventDefault()
    setBusy(true)
    try {
      const res = await fetch("/api/careeros/onboarding/step-two", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ linkedinText }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error || "Could not save LinkedIn text")
        return
      }
      toast.success("Step 2 saved")
      setStep(3)
    } finally {
      setBusy(false)
    }
  }

  async function submitStepThree(ev: React.FormEvent) {
    ev.preventDefault()
    setBusy(true)
    try {
      const res = await fetch("/api/careeros/onboarding/step-three", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentRoleTitle: currentRole,
          targetRoleTitle: targetRole || undefined,
          locationLabel,
          yearsExperience:
            yearsExperience.trim() === "" ? undefined : Number(yearsExperience),
          mergeLlmToBrain,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        brain?: { merged: boolean; reason?: string; scope?: string }
      }
      if (!res.ok) {
        toast.error(json.error || "Could not save profile")
        return
      }

      if (mergeLlmToBrain && json.brain) {
        if (json.brain.merged) {
          toast.success("Profile saved and LLM markdown appended to Company Brain.")
        } else if (json.brain.reason === "no_brain_scope") {
          toast.message(
            "Profile saved. Select an organisation or workspace in Juno (Company Brain) to sync LLM markdown.",
          )
        } else if (json.brain.reason === "no_llm_markdown") {
          toast.message("Profile saved. No LLM markdown found to sync to the brain.")
        } else {
          toast.success("Profile saved.")
        }
      } else {
        toast.success("Profile saved.")
      }

      setStep("building")
    } finally {
      setBusy(false)
    }
  }

  if (step === "building") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>We&apos;re building your career profile</CardTitle>
            <CardDescription>
              Module 1.2 will run structured extraction (Qwen) next. For now, your documents and
              confirmations are stored securely.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button asChild>
              <Link href="/careeros">Continue to CareerOS</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/context">Open Company Brain</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-12">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CareerOS</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Onboarding</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Step {step} of 3 — Module 1.1
        </p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Resume &amp; context</CardTitle>
            <CardDescription>
              Upload a PDF resume and/or paste text. Optionally add an LLM-generated markdown export
              (file or paste) — you can also sync that markdown into Juno&apos;s central brain on the
              last step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitStepOne} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="resumePdf">Resume PDF</Label>
                <Input
                  id="resumePdf"
                  name="resumePdf"
                  type="file"
                  accept="application/pdf,.pdf"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resumeText">Or paste resume text</Label>
                <Textarea
                  id="resumeText"
                  name="resumeText"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={6}
                  placeholder="Paste plain-text resume…"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llmMarkdownFile">LLM markdown file (.md)</Label>
                <Input
                  id="llmMarkdownFile"
                  name="llmMarkdownFile"
                  type="file"
                  accept=".md,.markdown,text/markdown"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llmMarkdownText">Or paste LLM markdown</Label>
                <Textarea
                  id="llmMarkdownText"
                  name="llmMarkdownText"
                  value={llmMarkdownPaste}
                  onChange={(e) => setLlmMarkdownPaste(e.target.value)}
                  rows={5}
                  placeholder="# Career summary from your LLM…"
                  className="font-mono text-sm"
                />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>LinkedIn</CardTitle>
            <CardDescription>
              Paste your profile summary / experience text (no scraping in v1). You can skip if you
              prefer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitStepTwo} className="flex flex-col gap-4">
              <Textarea
                value={linkedinText}
                onChange={(e) => setLinkedinText(e.target.value)}
                rows={10}
                placeholder="Paste LinkedIn profile text…"
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm details</CardTitle>
            <CardDescription>
              These fields drive market matching and your CareerOS profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitStepThree} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentRole">Current role</Label>
                <Input
                  id="currentRole"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value)}
                  required
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetRole">Target role (optional)</Label>
                <Input
                  id="targetRole"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Engineering Manager"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  required
                  placeholder="e.g. Dublin, Ireland"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="years">Years of experience</Label>
                <Input
                  id="years"
                  type="number"
                  min={0}
                  max={80}
                  step={0.5}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder="e.g. 8"
                />
              </div>
              <div className="flex items-start gap-2 rounded-md border border-border p-3">
                <Checkbox
                  id="mergeBrain"
                  checked={mergeLlmToBrain}
                  onCheckedChange={(v) => setMergeLlmToBrain(v === true)}
                />
                <Label htmlFor="mergeBrain" className="font-normal leading-snug cursor-pointer">
                  Append latest LLM markdown to Juno&apos;s Company Brain (markdown knowledge base)
                  when you have an active organisation or workspace selected.
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Finish onboarding"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
