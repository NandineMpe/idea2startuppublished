"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Sparkles } from "lucide-react"
import type { CreatorPositioning } from "@/lib/creator/canon/positioning"

/**
 * The brand-facing read of the canon. Every block is individually copyable,
 * because a media kit, a pitch email and a platform bio each want a different
 * length of the same argument.
 */
export function PositioningPanel({ initial }: { initial: CreatorPositioning | null }) {
  const router = useRouter()
  const [positioning, setPositioning] = useState<CreatorPositioning | null>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/creator/positioning", { method: "POST" })
      const data = (await res.json()) as { positioning?: CreatorPositioning; error?: string }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else {
        setPositioning(data.positioning ?? null)
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <h2 className="text-[13px] font-semibold text-foreground">Brand positioning</h2>
          </div>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-[620px]">
            Written for a marketer deciding in twenty seconds whether to reply — audience specificity,
            engagement against the category norm, and brand safety.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={pending}
          className="shrink-0 h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {pending ? "Writing…" : positioning ? "Rewrite" : "Write it"}
        </button>
      </div>

      {error && <p className="text-[12px] text-red-600 dark:text-red-400 mt-2">{error}</p>}

      {!positioning && !pending && (
        <p className="text-[12px] text-muted-foreground mt-3">
          Not written yet. It is derived from your canon and real metrics — no figure is invented.
        </p>
      )}

      {positioning && (
        <div className="mt-4 grid gap-4">
          <Block label="Headline" text={positioning.headline} emphasis />
          <Block label="Short bio" text={positioning.bio_short} />
          <Block label="Full bio" text={positioning.bio_long} />
          <Block label="Audience" text={positioning.audience} />

          <List label="Why a brand should look twice" items={positioning.why_brands} />
          <List label="Proof points" items={positioning.proof_points} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Tags label="Categories that fit" items={positioning.brand_categories} tone="fit" />
            <Tags label="Not a fit" items={positioning.not_a_fit} tone="avoid" />
          </div>
        </div>
      )}
    </section>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

function Block({ label, text, emphasis }: { label: string; text: string; emphasis?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <CopyButton text={text} />
      </div>
      <p
        className={
          emphasis
            ? "text-[15px] font-semibold text-foreground leading-snug"
            : "text-[13px] text-foreground/90 leading-relaxed"
        }
      >
        {text}
      </p>
    </div>
  )
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <CopyButton text={items.map((i) => `• ${i}`).join("\n")} />
      </div>
      <ul className="grid gap-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[13px] text-foreground/90 leading-relaxed flex gap-2">
            <span className="text-violet-500 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Tags({ label, items, tone }: { label: string; items: string[]; tone: "fit" | "avoid" }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={
              tone === "fit"
                ? "text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-400"
                : "text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            }
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
