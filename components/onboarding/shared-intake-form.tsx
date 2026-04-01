"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
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
}

export function SharedIntakeForm({ token }: { token: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<IntakeState>(EMPTY_FORM)

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
        <Card>
          <CardHeader>
            <CardTitle>Who should we anchor this to?</CardTitle>
            <CardDescription>Basic contact details help us keep the context grounded.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Your name"
              value={form.contactName}
              onChange={(event) => updateField("contactName", event.target.value)}
            />
            <Input
              type="email"
              placeholder="you@company.com"
              value={form.contactEmail}
              onChange={(event) => updateField("contactEmail", event.target.value)}
            />
            <Input
              placeholder="Founder / lead name"
              value={form.founderName}
              onChange={(event) => updateField("founderName", event.target.value)}
            />
            <Input
              placeholder="Company name"
              value={form.companyName}
              onChange={(event) => updateField("companyName", event.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company basics</CardTitle>
            <CardDescription>
              A website is optional, but useful. The richer fields below matter more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="url"
              placeholder="https://company.com"
              value={form.websiteUrl}
              onChange={(event) => updateField("websiteUrl", event.target.value)}
            />
            <Textarea
              className="min-h-[120px]"
              placeholder="What does the company do? Give the clearest plain-English description you can."
              value={form.companyDescription}
              onChange={(event) => updateField("companyDescription", event.target.value)}
            />
            <Textarea
              className="min-h-[120px]"
              placeholder="What problem are you solving, and for whom?"
              value={form.problem}
              onChange={(event) => updateField("problem", event.target.value)}
            />
            <Textarea
              className="min-h-[120px]"
              placeholder="What is the product or service? How does it solve the problem?"
              value={form.solution}
              onChange={(event) => updateField("solution", event.target.value)}
            />
            <Textarea
              className="min-h-[110px]"
              placeholder="Who is the target customer? Title, company type, buyer, or end user."
              value={form.targetMarket}
              onChange={(event) => updateField("targetMarket", event.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Commercial context</CardTitle>
            <CardDescription>
              These details make the generated output feel specific instead of generic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              className="min-h-[100px]"
              placeholder="How does the business make money?"
              value={form.businessModel}
              onChange={(event) => updateField("businessModel", event.target.value)}
            />
            <Textarea
              className="min-h-[100px]"
              placeholder="Any traction so far? Revenue, customers, pilots, growth, proof points."
              value={form.traction}
              onChange={(event) => updateField("traction", event.target.value)}
            />
            <Textarea
              className="min-h-[100px]"
              placeholder="What makes you meaningfully different from alternatives?"
              value={form.differentiators}
              onChange={(event) => updateField("differentiators", event.target.value)}
            />
            <Textarea
              className="min-h-[140px]"
              placeholder="Anything else Juno should know? Priorities, risks, competitors, founder background, vocabulary, constraints."
              value={form.contextNotes}
              onChange={(event) => updateField("contextNotes", event.target.value)}
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving context
              </>
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
