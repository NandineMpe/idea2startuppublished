"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Loader2, Send, CheckCircle2, AlertCircle,
  ExternalLink, Clock, Users, Search, ChevronDown, ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// ─── types ────────────────────────────────────────────────────────────────────

type StepStatus = "idle" | "running" | "done" | "error"

interface FounderPreview {
  profile: {
    company_name: string
    tagline: string
    company_description: string
    problem: string
    solution: string
    stage: string
    vertical: string
    business_model: string
    traction: string
    thesis: string
    founder_name: string
    founder_background: string
    founder_location: string
    icp: string[]
    competitors: string[]
    keywords: string[]
    priorities: string[]
    risks: string[]
  }
  emailPreview: {
    market_signal: string
    competitor_move: string
    icp_insight: string
  }
  knowledgeBasePreview: string
}

interface SeedResult {
  claimUrl: string
  emailSent: boolean
  profile: {
    company: string
    stage: string
    vertical: string
    icp: string[]
    competitors: string[]
  }
}

interface SeededInvite {
  id: string
  target_email: string
  target_name: string
  target_company: string
  seeded_at: string
  email_sent_at: string | null
  claimed_at: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = "text", disabled,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder: string; type?: string; disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground text-sm">{label}</Label>
      <Input type={type} placeholder={placeholder} value={value}
        onChange={(e) => onChange(e.target.value)} disabled={disabled}
        className="glass-input border-border text-foreground" />
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-sm text-foreground/80">
      <span className="shrink-0 text-primary mt-0.5">→</span>
      <span>{text}</span>
    </li>
  )
}

function PreviewCard({ preview }: { preview: FounderPreview }) {
  const [kbOpen, setKbOpen] = useState(false)
  const p = preview.profile

  return (
    <div className="rounded-xl border border-border bg-muted/10 space-y-5 p-5 text-sm">

      {/* Header */}
      <div>
        <p className="font-semibold text-foreground text-base">{p.company_name}</p>
        {p.tagline && <p className="text-muted-foreground mt-0.5">{p.tagline}</p>}
      </div>

      {/* Core facts */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {p.founder_name && <div><span className="text-muted-foreground">Founder: </span><span className="text-foreground">{p.founder_name}</span></div>}
        {p.founder_location && <div><span className="text-muted-foreground">Location: </span><span className="text-foreground">{p.founder_location}</span></div>}
        {p.stage && <div><span className="text-muted-foreground">Stage: </span><span className="text-foreground">{p.stage}</span></div>}
        {p.vertical && <div><span className="text-muted-foreground">Vertical: </span><span className="text-foreground">{p.vertical}</span></div>}
        {p.business_model && <div><span className="text-muted-foreground">Model: </span><span className="text-foreground">{p.business_model}</span></div>}
        {p.traction && <div><span className="text-muted-foreground">Traction: </span><span className="text-foreground">{p.traction}</span></div>}
      </div>

      {/* Description */}
      {p.company_description && (
        <p className="text-muted-foreground leading-relaxed">{p.company_description}</p>
      )}

      {/* Founder background */}
      {p.founder_background && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Founder background</p>
          <p className="text-foreground/80 leading-relaxed">{p.founder_background}</p>
        </div>
      )}

      {/* ICP */}
      {p.icp.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">ICP</p>
          <ul className="space-y-1">{p.icp.map((v, i) => <Bullet key={i} text={v} />)}</ul>
        </div>
      )}

      {/* Competitors */}
      {p.competitors.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Competitors mapped</p>
          <div className="flex flex-wrap gap-1.5">
            {p.competitors.map((c, i) => (
              <span key={i} className="rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-xs text-foreground">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Priorities */}
      {p.priorities.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Inferred 90-day priorities</p>
          <ul className="space-y-1">{p.priorities.map((v, i) => <Bullet key={i} text={v} />)}</ul>
        </div>
      )}

      {/* Risks */}
      {p.risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Risks</p>
          <ul className="space-y-1">{p.risks.map((v, i) => <Bullet key={i} text={v} />)}</ul>
        </div>
      )}

      {/* Email preview bullets */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">Email intelligence bullets</p>
        <ul className="space-y-1">
          <Bullet text={preview.emailPreview.market_signal} />
          <Bullet text={preview.emailPreview.competitor_move} />
          <Bullet text={preview.emailPreview.icp_insight} />
        </ul>
      </div>

      {/* Knowledge base preview toggle */}
      {preview.knowledgeBasePreview && (
        <div>
          <button
            type="button"
            onClick={() => setKbOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            {kbOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Knowledge base preview
          </button>
          {kbOpen && (
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed font-mono overflow-auto max-h-64">
              {preview.knowledgeBasePreview}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ─── main form (two-step) ──────────────────────────────────────────────────────

function SeedForm() {
  const [form, setForm] = useState({
    targetEmail: "", founderName: "", companyName: "",
    companyUrl: "", linkedinUrl: "", sendEmail: true,
  })

  const [previewStatus, setPreviewStatus] = useState<StepStatus>("idle")
  const [preview, setPreview]             = useState<FounderPreview | null>(null)
  const [previewError, setPreviewError]   = useState<string | null>(null)

  const [seedStatus, setSeedStatus]       = useState<StepStatus>("idle")
  const [seedResult, setSeedResult]       = useState<SeedResult | null>(null)
  const [seedError, setSeedError]         = useState<string | null>(null)

  const canPreview = form.founderName && form.companyName && form.companyUrl
  const canSeed    = preview && form.targetEmail && seedStatus !== "running"

  // ── step 1: preview ────────────────────────────────────────────────────────
  const runPreview = useCallback(async () => {
    setPreviewStatus("running")
    setPreview(null)
    setPreviewError(null)
    setSeedResult(null)
    setSeedStatus("idle")

    try {
      const res = await fetch("/api/admin/preview-founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          founderName: form.founderName,
          companyName: form.companyName,
          companyUrl:  form.companyUrl,
          linkedinUrl: form.linkedinUrl || undefined,
        }),
      })
      const data = await res.json() as { error?: string } & Partial<FounderPreview>
      if (!res.ok) { setPreviewStatus("error"); setPreviewError(data.error ?? "Preview failed"); return }
      setPreview(data as FounderPreview)
      setPreviewStatus("done")
    } catch (e: unknown) {
      setPreviewStatus("error")
      setPreviewError(e instanceof Error ? e.message : "Network error")
    }
  }, [form])

  // ── step 2: seed ───────────────────────────────────────────────────────────
  const runSeed = useCallback(async () => {
    setSeedStatus("running")
    setSeedResult(null)
    setSeedError(null)

    try {
      const res = await fetch("/api/admin/seed-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      })
      const data = await res.json() as { ok?: boolean; error?: string } & Partial<SeedResult>
      if (!res.ok) { setSeedStatus("error"); setSeedError(data.error ?? "Seed failed"); return }
      setSeedResult({ claimUrl: data.claimUrl!, emailSent: data.emailSent ?? false, profile: data.profile! })
      setSeedStatus("done")
    } catch (e: unknown) {
      setSeedStatus("error")
      setSeedError(e instanceof Error ? e.message : "Network error")
    }
  }, [form])

  return (
    <div className="space-y-6">

      {/* Form fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Founder name"    value={form.founderName}  onChange={(v) => setForm(f => ({...f, founderName: v}))}  placeholder="Sarah Chen" disabled={previewStatus === "running"} />
        <Field label="Company"         value={form.companyName}  onChange={(v) => setForm(f => ({...f, companyName: v}))}  placeholder="Basis" disabled={previewStatus === "running"} />
        <Field label="Website"         value={form.companyUrl}   onChange={(v) => setForm(f => ({...f, companyUrl: v}))}   placeholder="https://basis.com" type="url" disabled={previewStatus === "running"} />
        <Field label="LinkedIn (optional)" value={form.linkedinUrl} onChange={(v) => setForm(f => ({...f, linkedinUrl: v}))} placeholder="https://linkedin.com/in/..." type="url" disabled={previewStatus === "running"} />
      </div>

      {/* Step 1 button */}
      <Button
        onClick={runPreview}
        disabled={!canPreview || previewStatus === "running"}
        variant="outline"
        className="border-primary/30 hover:bg-primary/10 text-foreground"
      >
        {previewStatus === "running"
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Researching… (~30s)</>
          : <><Search className="mr-2 h-4 w-4" />Preview what Juno found</>}
      </Button>

      {previewError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{previewError}
        </div>
      )}

      {/* Preview result */}
      {preview && previewStatus === "done" && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">
            Does this look right? If yes, add their email and seed the account.
          </p>
          <PreviewCard preview={preview} />

          {/* Step 2: email + send */}
          <div className="space-y-4 pt-2 border-t border-border">
            <Field
              label="Founder email"
              value={form.targetEmail}
              onChange={(v) => setForm(f => ({...f, targetEmail: v}))}
              placeholder="sarah@basis.com"
              type="email"
              disabled={seedStatus === "running"}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={form.sendEmail}
                onClick={() => setForm(f => ({...f, sendEmail: !f.sendEmail}))}
                disabled={seedStatus === "running"}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.sendEmail ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${form.sendEmail ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <span className="text-sm text-muted-foreground">Send "If I was your agent" email via AgentMail</span>
            </div>

            <Button
              onClick={runSeed}
              disabled={!canSeed || seedStatus === "running" || seedStatus === "done"}
              className="bg-primary hover:bg-primary/90 text-black font-medium"
            >
              {seedStatus === "running"
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Seeding account… (~2 min)</>
                : <><Send className="mr-2 h-4 w-4" />Seed account {form.sendEmail ? "& send email" : "(no email)"}</>}
            </Button>

            {seedError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{seedError}
              </div>
            )}

            {seedStatus === "done" && seedResult && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 space-y-3 p-5">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Account seeded — {seedResult.emailSent ? "email sent via AgentMail" : "no email sent"}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <a href={seedResult.claimUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-primary underline underline-offset-4 hover:text-primary/80">
                    Preview claim link <ExternalLink className="h-3 w-3" />
                  </a>
                  <button type="button" onClick={() => navigator.clipboard.writeText(seedResult.claimUrl)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── invite log ───────────────────────────────────────────────────────────────

function InviteLog() {
  const [invites, setInvites] = useState<SeededInvite[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/seed-account", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { invites?: SeededInvite[] }) => { setInvites(d.invites ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
  if (invites.length === 0) return <p className="text-sm text-muted-foreground py-4">No seeded accounts yet.</p>

  return (
    <div className="space-y-2">
      {invites.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{inv.target_name} — {inv.target_company}</p>
            <p className="text-muted-foreground text-xs truncate">{inv.target_email}</p>
          </div>
          <div className="shrink-0 ml-4">
            {inv.claimed_at ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <CheckCircle2 className="h-3 w-3" /> Claimed
              </span>
            ) : inv.email_sent_at ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Send className="h-3 w-3" /> Emailed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <Clock className="h-3 w-3" /> Seeded
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── export ───────────────────────────────────────────────────────────────────

export function SeedOutreachPanel() {
  return (
    <div className="space-y-6">
      <Card className="glass-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Seed a founder account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Research the target first to confirm Juno has the right intel, then seed their
            full dashboard and send the "If I was your agent" email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SeedForm />
        </CardContent>
      </Card>

      <Card className="glass-card border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-foreground">Sent invites</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <InviteLog />
        </CardContent>
      </Card>
    </div>
  )
}
