"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { ExternalLink, Plus, Tag } from "lucide-react"
import { saveDeal, setDealState } from "@/lib/creator/brand/actions"
import { PROTOCOL_SEEDS } from "@/lib/creator/brand/protocols"
import type { BrandDeal } from "@/lib/creator/brand/load"
import { cn } from "@/lib/utils"

/**
 * Deals she has found, not deals we claim to have found.
 *
 * There is no dependable open feed of Dublin salon offers. Groupon has no
 * public API worth building on, and the aggregators that do have feeds are
 * affiliate networks with their own approval process. Inventing a listing would
 * send her to a clinic that never ran the offer, which is a worse outcome than
 * an empty panel and is exactly the failure this product keeps refusing.
 *
 * So the panel does the part that is real and that no deals site does: it holds
 * the voucher against what she currently pays, so a "deal" that is above her
 * usual price is visible as one, and it counts down to expiry, because the
 * common way money is actually lost here is a voucher bought and never booked.
 */
export function BrandDeals({
  deals,
  currency,
  paidByKey,
}: {
  deals: BrandDeal[]
  currency: string
  paidByKey: Record<string, number | null>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const live = deals.filter((d) => d.state === "saved" || d.state === "booked")
  const rest = deals.filter((d) => d.state !== "saved" && d.state !== "booked")

  function save(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const r = await saveDeal(formData)
      if (!r.ok) setError(r.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  function mark(id: string, state: string) {
    startTransition(async () => {
      const r = await setDealState(id, state)
      if (!r.ok) setError(r.error)
      else router.refresh()
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold text-foreground">Deals</h2>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1 h-7 rounded-md border border-border px-2 text-[11px] text-foreground hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      <p className="text-[11.5px] text-muted-foreground leading-relaxed max-w-2xl mb-3">
        Paste one in when you find it and this holds it against what you already pay, so an offer
        that is not actually cheaper shows up as one, and it counts down to expiry. Worth checking:
        Groupon Dublin, Wowcher IE, and the salon's own Instagram, which is usually where the real
        last-minute cancellation slots go first.
      </p>

      {error && <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">{error}</p>}

      {open && (
        <form action={save} className="grid gap-3 mb-4 pb-4 border-b border-border">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="What it is" name="title" required />
            <Field label="Where" name="provider" />
            <label className="grid gap-1">
              <span className="text-[11px] text-muted-foreground">Against which treatment</span>
              <select
                name="protocol_key"
                className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
              >
                <option value="">Not linked</option>
                {PROTOCOL_SEEDS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <Field label={`Deal price (${currency})`} name="price" type="number" />
            <Field label={`Normal price (${currency})`} name="normal_price" type="number" />
            <Field label="Expires" name="expires_on" type="date" />
            <Field label="Link" name="url" />
            <Field label="Source" name="source" hint="Groupon, Instagram, walked past it" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-8 rounded-md bg-violet-600 px-3 text-[12px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save deal"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded-md border border-border px-3 text-[12px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!deals.length && !open && (
        <p className="text-[12px] text-muted-foreground py-2">Nothing saved yet.</p>
      )}

      <div className="grid gap-2">
        {[...live, ...rest].map((d) => {
          const usual = d.protocol_key ? paidByKey[d.protocol_key] : null
          // The comparison that matters. A voucher is only a deal against the
          // price she actually pays, not against the "normal price" printed
          // on it, which is set by whoever is selling the voucher.
          const better = usual !== null && usual !== undefined && d.price !== null && d.price < usual
          const worse = usual !== null && usual !== undefined && d.price !== null && d.price >= usual
          const expiring = d.days_left !== null && d.days_left <= 7 && d.state !== "used"
          const dead = d.days_left !== null && d.days_left < 0

          return (
            <div
              key={d.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                dead ? "border-border opacity-60" : expiring ? "border-amber-500/40" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] font-medium text-foreground">
                    {d.title}
                    {d.provider ? <span className="text-muted-foreground font-normal"> · {d.provider}</span> : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    {d.price !== null ? `${currency} ${d.price}` : "no price"}
                    {d.normal_price !== null ? ` (listed ${currency} ${d.normal_price})` : ""}
                    {usual !== null && usual !== undefined ? ` · you usually pay ${currency} ${usual}` : ""}
                    {d.days_left !== null
                      ? dead
                        ? " · expired"
                        : ` · ${d.days_left} days left`
                      : ""}
                  </p>
                  {better && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                      Cheaper than your usual by {currency} {Math.round((usual as number) - (d.price as number))}.
                    </p>
                  )}
                  {worse && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                      Not actually cheaper than what you already pay.
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {d.state === "saved" && (
                    <button
                      onClick={() => mark(d.id, "booked")}
                      disabled={pending}
                      className="h-7 rounded-md border border-border px-2 text-[11px] hover:bg-accent disabled:opacity-50"
                    >
                      Booked
                    </button>
                  )}
                  {d.state === "booked" && (
                    <button
                      onClick={() => mark(d.id, "used")}
                      disabled={pending}
                      className="h-7 rounded-md border border-border px-2 text-[11px] hover:bg-accent disabled:opacity-50"
                    >
                      Used
                    </button>
                  )}
                  {d.state !== "passed" && d.state !== "used" && (
                    <button
                      onClick={() => mark(d.id, "passed")}
                      disabled={pending}
                      className="h-7 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Pass
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Field({
  label,
  name,
  type = "text",
  hint,
  required,
}: {
  label: string
  name: string
  type?: string
  hint?: string
  required?: boolean
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
      />
      {hint && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
    </label>
  )
}
