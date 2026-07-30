"use client"

import { useState } from "react"
import { AlertTriangle, Check, Copy, Mail } from "lucide-react"
import type { BriefReply } from "@/lib/creator/deals/brief-reply"

/**
 * Paste an inbound brand email, get a reply grounded in real rates and format
 * performance. The reply is presented as one copy-paste block; everything the
 * brand should not see (watch-outs, the rate rationale) sits outside it.
 */
export function BriefReplyPanel() {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<BriefReply | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function draft() {
    setPending(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/creator/brief-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = (await res.json()) as { reply?: BriefReply; error?: string }
      if (!res.ok) setError(data.error ?? `Failed (HTTP ${res.status})`)
      else setResult(data.reply ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.")
    } finally {
      setPending(false)
    }
  }

  async function copy() {
    if (!result) return
    await navigator.clipboard.writeText(result.reply)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Mail className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <h2 className="text-[13px] font-semibold text-foreground">Reply to a brand email</h2>
      </div>
      <p className="text-[12px] text-muted-foreground mb-3 leading-relaxed">
        Paste an inbound brief. The reply is priced from your real rate band and recommends the format
        your numbers support.
      </p>

      <textarea
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        rows={6}
        placeholder="Paste the full email here, including their ask and any budget they mention…"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60"
      />

      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={draft}
          disabled={pending || email.trim().length < 40}
          className="h-9 rounded-md bg-violet-600 px-4 text-[13px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {pending ? "Reading the brief…" : "Draft a reply"}
        </button>
        {pending && (
          <span className="text-[11px] text-muted-foreground">
            Pricing against your rate band — takes up to a minute.
          </span>
        )}
        {error && <span className="text-[12px] text-red-600 dark:text-red-400">{error}</span>}
      </div>

      {result && (
        <div className="mt-5 grid gap-4">
          <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 grid gap-1.5">
            {result.brand && <Row label="From" value={result.brand} />}
            <Row label="What they want" value={result.what_they_want} />
            {result.deliverables.length > 0 && (
              <Row label="Deliverables" value={result.deliverables.join(" · ")} />
            )}
            <Row label="Their budget" value={result.stated_budget ?? "not stated"} />
            <Row
              label="Your quote"
              value={`${result.quoted_rate.currency} ${result.quoted_rate.low.toLocaleString()}–${result.quoted_rate.high.toLocaleString()} — ${result.quoted_rate.basis}`}
            />
            <Row
              label="Format to pitch"
              value={`${result.recommended_format.label} — ${result.recommended_format.why}`}
            />
          </div>

          {result.watch_outs.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1.5 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Before you send — your eyes only
              </p>
              <ul className="grid gap-1">
                {result.watch_outs.map((w, i) => (
                  <li key={i} className="text-[12px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Your reply
              </span>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 h-7 rounded-md border border-border px-2.5 text-[12px] font-medium text-foreground hover:bg-accent transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="px-4 py-3 text-[13px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {result.reply}
            </pre>
          </div>
        </div>
      )}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12px] text-muted-foreground leading-relaxed">
      <span className="font-medium text-foreground/80">{label}:</span> {value}
    </p>
  )
}
