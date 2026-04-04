"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ChevronDown,
  Loader2,
  Palette,
  Save,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { RefineSection } from "@/types/branding"

type ChannelKey = "linkedin" | "cold_email" | "reddit_hn"

type BrandingState = {
  brand_voice_dna: string
  brand_promise: string
  brand_channel_voice: Record<ChannelKey, string>
  brand_words_use: string[]
  brand_words_never: string[]
  brand_credibility_hooks: string[]
}

const CHANNEL_LABEL: Record<ChannelKey, { title: string; hint: string }> = {
  linkedin: {
    title: "LinkedIn",
    hint: "First-person narrative, story-led hooks, length, what to avoid (e.g. obvious sales tone).",
  },
  cold_email: {
    title: "Cold email",
    hint: "Structure (e.g. pain → bridge → CTA), length, tone—buyers’ inbox, not a billboard.",
  },
  reddit_hn: {
    title: "Reddit / Hacker News",
    hint: "Answer first, zero marketing speak, technical depth when it earns trust.",
  },
}

const REFINE_KEY: Record<ChannelKey, RefineSection> = {
  linkedin: "brand_channel_linkedin",
  cold_email: "brand_channel_cold_email",
  reddit_hn: "brand_channel_reddit_hn",
}

function parseStringArray(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) {
    return val
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (typeof val === "string") {
    try {
      const p = JSON.parse(val) as unknown
      if (Array.isArray(p)) {
        return p
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean)
      }
    } catch {
      return val
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }
  return []
}

function splitLegacyLines(s: string): string[] {
  return s
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function profileToState(p: Record<string, unknown>): BrandingState {
  const ch = p.brand_channel_voice
  let channel: Record<ChannelKey, string> = { linkedin: "", cold_email: "", reddit_hn: "" }
  if (ch && typeof ch === "object" && !Array.isArray(ch)) {
    const o = ch as Record<string, unknown>
    channel = {
      linkedin: String(o.linkedin ?? "").trim(),
      cold_email: String(o.cold_email ?? "").trim(),
      reddit_hn: String(o.reddit_hn ?? "").trim(),
    }
  }

  let wordsUse = parseStringArray(p.brand_words_use)
  let wordsNever = parseStringArray(p.brand_words_never)
  let hooks = parseStringArray(p.brand_credibility_hooks)

  if (wordsNever.length === 0 && typeof p.brand_never_say === "string" && p.brand_never_say.trim()) {
    wordsNever = splitLegacyLines(p.brand_never_say)
  }
  if (hooks.length === 0 && typeof p.brand_proof_points === "string" && p.brand_proof_points.trim()) {
    hooks = p.brand_proof_points
      .split(/[\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  const dna =
    (typeof p.brand_voice_dna === "string" && p.brand_voice_dna.trim()
      ? p.brand_voice_dna
      : typeof p.brand_voice === "string"
        ? p.brand_voice
        : "") || ""

  return {
    brand_voice_dna: dna,
    brand_promise: typeof p.brand_promise === "string" ? p.brand_promise : "",
    brand_channel_voice: channel,
    brand_words_use: wordsUse,
    brand_words_never: wordsNever,
    brand_credibility_hooks: hooks,
  }
}

function TagListEditor({
  label,
  tags,
  onChange,
  placeholder,
  className,
}: {
  label: string
  tags: string[]
  onChange: (next: string[]) => void
  placeholder: string
  className?: string
}) {
  const [draft, setDraft] = useState("")

  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...tags]
    for (const p of parts) {
      if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    onChange(next)
    setDraft("")
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex min-h-[44px] flex-wrap gap-1.5 rounded-md border border-border bg-background p-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[12px] text-foreground"
          >
            {t}
            <button
              type="button"
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(draft)
            }
          }}
          placeholder={placeholder}
          className="min-w-[140px] flex-1 border-0 bg-transparent p-0 text-[13px] shadow-none focus-visible:ring-0 h-7"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">Press Enter to add. Paste comma-separated lists.</p>
    </div>
  )
}

export function BrandingPage({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draftingDna, setDraftingDna] = useState(false)
  const [draftingKit, setDraftingKit] = useState(false)
  const [refining, setRefining] = useState<RefineSection | null>(null)
  const [hints, setHints] = useState<Partial<Record<RefineSection, string>>>({})
  const [state, setState] = useState<BrandingState>({
    brand_voice_dna: "",
    brand_promise: "",
    brand_channel_voice: { linkedin: "", cold_email: "", reddit_hn: "" },
    brand_words_use: [],
    brand_words_never: [],
    brand_credibility_hooks: [],
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/company/profile", { credentials: "include" })
      const data = (await res.json()) as { profile?: Record<string, unknown> | null }
      const p = data.profile
      if (!p) {
        toast({ title: "No company profile", description: "Complete onboarding first.", variant: "destructive" })
        return
      }
      setState(profileToState(p))
    } catch {
      toast({ title: "Could not load profile", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  const payloadForRefine = () => ({
    brand_voice_dna: state.brand_voice_dna,
    brand_promise: state.brand_promise,
    brand_channel_voice: state.brand_channel_voice,
    brand_words_use: state.brand_words_use,
    brand_words_never: state.brand_words_never,
    brand_credibility_hooks: state.brand_credibility_hooks,
  })

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/company/profile/branding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadForRefine()),
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || "Save failed")
      }
      toast({
        title: "Saved",
        description: "Every agent reads this before writing content, outreach, or briefs.",
      })
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const draftVoiceDna = async () => {
    setDraftingDna(true)
    try {
      const res = await fetch("/api/company/branding-suggest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "draft_voice_dna" }),
      })
      const data = (await res.json()) as { brand_voice_dna?: string; error?: string }
      if (!res.ok) throw new Error(data.error || "Draft failed")
      if (data.brand_voice_dna) {
        setState((s) => ({ ...s, brand_voice_dna: data.brand_voice_dna ?? "" }))
      }
      toast({
        title: "Voice DNA drafted",
        description: "Edit until it sounds like you—demonstration beats adjectives.",
      })
    } catch (e) {
      toast({
        title: "Could not draft",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setDraftingDna(false)
    }
  }

  const draftFullKit = async () => {
    setDraftingKit(true)
    try {
      const res = await fetch("/api/company/branding-suggest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "draft_kit" }),
      })
      const data = (await res.json()) as Partial<BrandingState> & { error?: string }
      if (!res.ok) throw new Error(data.error || "Draft failed")
      setState((prev) => {
        const ch = data.brand_channel_voice
        return {
          brand_voice_dna: data.brand_voice_dna ?? prev.brand_voice_dna,
          brand_promise: data.brand_promise ?? prev.brand_promise,
          brand_channel_voice: ch
            ? {
                linkedin: ch.linkedin ?? prev.brand_channel_voice.linkedin,
                cold_email: ch.cold_email ?? prev.brand_channel_voice.cold_email,
                reddit_hn: ch.reddit_hn ?? prev.brand_channel_voice.reddit_hn,
              }
            : prev.brand_channel_voice,
          brand_words_use: data.brand_words_use ?? prev.brand_words_use,
          brand_words_never: data.brand_words_never ?? prev.brand_words_never,
          brand_credibility_hooks: data.brand_credibility_hooks ?? prev.brand_credibility_hooks,
        }
      })
      toast({
        title: "Full kit drafted",
        description: "Tune every section, then save—this is the contract agents follow.",
      })
    } catch (e) {
      toast({
        title: "Could not draft",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setDraftingKit(false)
    }
  }

  const refine = async (section: RefineSection) => {
    setRefining(section)
    try {
      const res = await fetch("/api/company/branding-suggest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "refine_section",
          section,
          hint: hints[section] || undefined,
          ...payloadForRefine(),
        }),
      })
      const data = (await res.json()) as { suggestion?: string | string[]; error?: string }
      if (!res.ok) throw new Error(data.error || "Refine failed")

      if (Array.isArray(data.suggestion)) {
        const arr = data.suggestion.map((s) => String(s).trim()).filter(Boolean)
        if (section === "brand_words_use") setState((s) => ({ ...s, brand_words_use: arr }))
        else if (section === "brand_words_never") setState((s) => ({ ...s, brand_words_never: arr }))
        else if (section === "brand_credibility_hooks") setState((s) => ({ ...s, brand_credibility_hooks: arr }))
      } else {
        const text = String(data.suggestion ?? "").trim()
        if (!text && section !== "brand_words_use" && section !== "brand_words_never") {
          throw new Error("Empty response")
        }
        if (section === "brand_voice_dna") setState((s) => ({ ...s, brand_voice_dna: text }))
        else if (section === "brand_promise") setState((s) => ({ ...s, brand_promise: text }))
        else if (section === "brand_channel_linkedin") {
          setState((s) => ({
            ...s,
            brand_channel_voice: { ...s.brand_channel_voice, linkedin: text },
          }))
        } else if (section === "brand_channel_cold_email") {
          setState((s) => ({
            ...s,
            brand_channel_voice: { ...s.brand_channel_voice, cold_email: text },
          }))
        } else if (section === "brand_channel_reddit_hn") {
          setState((s) => ({
            ...s,
            brand_channel_voice: { ...s.brand_channel_voice, reddit_hn: text },
          }))
        }
      }

      toast({ title: "Updated", description: "Review and save when it matches your voice." })
    } catch (e) {
      toast({
        title: "Refine failed",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      })
    } finally {
      setRefining(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {embedded ? (
        <div className="space-y-1 border-b border-border pb-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">GTM · Branding</p>
          <p className="text-[13px] text-muted-foreground">
            Same voice kit as the dedicated page —{" "}
            <Link href="/dashboard/branding" className="text-primary hover:underline">
              Open full-page branding
            </Link>
            .
          </p>
        </div>
      ) : null}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Palette className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Voice &amp; brand</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">How Juno speaks for you</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Voice and brand are not cosmetic—they are the operating instructions every agent follows when drafting
          content, outreach, and briefs. If this is wrong, everything Juno ships sounds wrong. Think of this page like
          briefing a new hire on day one: how we talk, what we stand for, what makes people trust us, and what we
          never say.
        </p>
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Show, don&apos;t only tell: </span>
          the Voice DNA field should contain writing in your actual voice—sample LinkedIn, email, and Reddit
          patterns—so agents reproduce rhythm and jargon level, not adjectives about &quot;credibility.&quot;
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="default" onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save for agents
        </Button>
        <Button type="button" variant="outline" onClick={draftFullKit} disabled={draftingKit} className="gap-2">
          {draftingKit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Draft full kit from company brain
        </Button>
      </div>

      {/* (1) Voice DNA */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Voice DNA</h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Three to four paragraphs in your real voice—how you&apos;d open a LinkedIn post, a cold email, and a
            Reddit reply. Agents match this rhythm; describing &quot;Big Four credibility&quot; without showing it
            will not work.
          </p>
        </div>
        <Textarea
          value={state.brand_voice_dna}
          onChange={(e) => setState((s) => ({ ...s, brand_voice_dna: e.target.value }))}
          rows={16}
          placeholder={`Use clear section markers, e.g.:

--- LINKEDIN ---
(Your post...)

--- COLD EMAIL ---
(Your email...)

--- REDDIT / HN ---
(Your reply...)`}
          className="min-h-[320px] resize-y font-mono text-[13px] leading-relaxed"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <Button
              type="button"
              variant="secondary"
              className="gap-2 sm:shrink-0"
              disabled={draftingDna || draftingKit}
              onClick={draftVoiceDna}
            >
              {draftingDna ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Draft from company brain
            </Button>
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Optional direction for the model
              </label>
              <Input
                value={hints.brand_voice_dna ?? ""}
                onChange={(e) =>
                  setHints((h) => ({ ...h, brand_voice_dna: e.target.value }))
                }
                placeholder='e.g. "more technical", "shorter sentences", "CFO-appropriate"'
                className="text-[13px]"
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={refining !== null}
            onClick={() => refine("brand_voice_dna")}
          >
            {refining === "brand_voice_dna" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Refine with AI
          </Button>
        </div>
      </section>

      {/* (2) The line */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">The line</h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            One sentence: the outcome you deliver or the belief you won&apos;t compromise. Headlines and hooks anchor
            here.
          </p>
        </div>
        <Textarea
          value={state.brand_promise}
          onChange={(e) => setState((s) => ({ ...s, brand_promise: e.target.value }))}
          rows={2}
          className="text-[13px] leading-relaxed"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            value={hints.brand_promise ?? ""}
            onChange={(e) => setHints((h) => ({ ...h, brand_promise: e.target.value }))}
            placeholder="Optional direction for the model"
            className="flex-1 text-[13px]"
          />
          <Button
            type="button"
            variant="secondary"
            className="gap-2 shrink-0"
            disabled={refining !== null}
            onClick={() => refine("brand_promise")}
          >
            {refining === "brand_promise" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Refine
          </Button>
        </div>
      </section>

      {/* (3) Channel voice */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Channel voice</h2>
          <p className="text-[13px] text-muted-foreground">
            You sound different on LinkedIn than in inbox or on Reddit—set rules per channel so agents don&apos;t use
            one voice everywhere.
          </p>
        </div>
        {(Object.keys(CHANNEL_LABEL) as ChannelKey[]).map((key) => (
          <Collapsible key={key} defaultOpen className="rounded-xl border border-border bg-card shadow-sm">
            <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm font-medium hover:bg-muted/40">
              {CHANNEL_LABEL[key].title}
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border px-5 pb-4 pt-2">
              <p className="mb-2 text-[12px] text-muted-foreground">{CHANNEL_LABEL[key].hint}</p>
              <Textarea
                value={state.brand_channel_voice[key]}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    brand_channel_voice: { ...s.brand_channel_voice, [key]: e.target.value },
                  }))
                }
                rows={4}
                className="text-[13px] leading-relaxed"
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input
                  value={hints[REFINE_KEY[key]] ?? ""}
                  onChange={(e) =>
                    setHints((h) => ({ ...h, [REFINE_KEY[key]]: e.target.value }))
                  }
                  placeholder="Optional direction for the model"
                  className="flex-1 text-[13px]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={refining !== null}
                  onClick={() => refine(REFINE_KEY[key])}
                >
                  {refining === REFINE_KEY[key] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Refine
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>

      {/* (4) Vocabulary */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Vocabulary</h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            The fastest way to keep AI output human: ban lazy superlatives, and name the phrases you actually use in
            front of customers.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <TagListEditor
            label="Words we use"
            tags={state.brand_words_use}
            onChange={(brand_words_use) => setState((s) => ({ ...s, brand_words_use }))}
            placeholder="Add a phrase…"
          />
          <TagListEditor
            label="Words we never use"
            tags={state.brand_words_never}
            onChange={(brand_words_never) => setState((s) => ({ ...s, brand_words_never }))}
            placeholder="e.g. revolutionize, seamless, leverage…"
          />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Input
              value={hints.brand_words_use ?? ""}
              onChange={(e) => setHints((h) => ({ ...h, brand_words_use: e.target.value }))}
              placeholder="Direction: refine “words we use”"
              className="text-[13px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refining !== null}
              onClick={() => refine("brand_words_use")}
            >
              {refining === "brand_words_use" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refine list"}
            </Button>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Input
              value={hints.brand_words_never ?? ""}
              onChange={(e) => setHints((h) => ({ ...h, brand_words_never: e.target.value }))}
              placeholder="Direction: refine “never use”"
              className="text-[13px]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={refining !== null}
              onClick={() => refine("brand_words_never")}
            >
              {refining === "brand_words_never" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refine list"}
            </Button>
          </div>
        </div>
      </section>

      {/* (5) Credibility hooks */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Credibility hooks</h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Proof agents should weave naturally—prior firms, schools, metrics, named customer types—not bullet dumps in
            the final copy.
          </p>
        </div>
        <TagListEditor
          label="Hooks"
          tags={state.brand_credibility_hooks}
          onChange={(brand_credibility_hooks) => setState((s) => ({ ...s, brand_credibility_hooks }))}
          placeholder="Add a hook…"
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Input
            value={hints.brand_credibility_hooks ?? ""}
            onChange={(e) => setHints((h) => ({ ...h, brand_credibility_hooks: e.target.value }))}
            placeholder="Optional direction for the model"
            className="flex-1 text-[13px]"
          />
          <Button
            type="button"
            variant="secondary"
            className="gap-2 shrink-0"
            disabled={refining !== null}
            onClick={() => refine("brand_credibility_hooks")}
          >
            {refining === "brand_credibility_hooks" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Refine list
          </Button>
        </div>
      </section>

      <p className="text-center text-[12px] text-muted-foreground">
        Nothing ships to agents until you click Save. Draft and refine are previews until then.
      </p>
    </div>
  )
}
