"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Clock } from "lucide-react"
import { markProtocolDone, saveProtocol } from "@/lib/creator/brand/actions"
import { PROTOCOL_BY_KEY, presentationNote, type Presentation } from "@/lib/creator/brand/protocols"
import { VERDICT_LABEL, type Verdict } from "@/lib/creator/brand/readiness"
import type { BrandProtocol } from "@/lib/creator/brand/load"
import { cn } from "@/lib/utils"

/**
 * One treatment, led by its verdict rather than by its name.
 *
 * The colour is doing real work here. "Too late for this shoot" is the only
 * thing on the screen that stops her spending money that makes the shoot worse,
 * so it reads as a warning and everything settled reads as nothing.
 */
const VERDICT_STYLE: Record<Verdict, string> = {
  too_late: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  book_now: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30",
  day_before: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  scheduled_fine: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  not_due: "bg-muted text-muted-foreground border-border",
  no_shoot_date: "bg-muted text-muted-foreground border-border",
}

export function BrandProtocolCard({
  protocol,
  presentation,
  currency,
}: {
  protocol: BrandProtocol
  presentation: Presentation | null
  currency: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const seed = PROTOCOL_BY_KEY.get(protocol.protocol_key)
  const note = seed ? presentationNote(seed, presentation) : null
  const { state } = protocol

  function done() {
    startTransition(async () => {
      const r = await markProtocolDone(protocol.protocol_key)
      if (!r.ok) setError(r.error)
      else router.refresh()
    })
  }

  function save(formData: FormData) {
    startTransition(async () => {
      const r = await saveProtocol(formData)
      if (!r.ok) setError(r.error)
      else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <article
      className={cn(
        "rounded-xl border bg-card p-4",
        protocol.active ? "border-border" : "border-dashed border-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[13px] font-semibold text-foreground">{protocol.label}</h3>
            {protocol.active && (
              <span className={cn("text-[10.5px] px-1.5 py-0.5 rounded border font-medium", VERDICT_STYLE[state.verdict])}>
                {VERDICT_LABEL[state.verdict]}
              </span>
            )}
            {seed?.clinical && (
              <span className="text-[10.5px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                clinician
              </span>
            )}
          </div>
          {seed && <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-2xl">{seed.what}</p>}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {protocol.active && (
            <button
              onClick={done}
              disabled={pending}
              title="Record that you had this done today"
              className="inline-flex items-center gap-1 h-7 rounded-md border border-border px-2 text-[11px] text-foreground hover:bg-accent disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Done today
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 h-7 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {protocol.active ? "Edit" : "Track this"}
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {protocol.active && (
        <p className="text-[12px] text-foreground/80 mt-2.5 leading-relaxed flex items-start gap-1.5">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <span>{state.line}</span>
        </p>
      )}

      {note && (
        <p className="text-[12px] text-foreground/75 mt-2 leading-relaxed rounded-lg bg-muted/50 px-3 py-2 max-w-2xl">
          {note}
        </p>
      )}

      {seed?.watch_out && (
        <p className="text-[11.5px] text-muted-foreground mt-2 leading-relaxed max-w-2xl">
          <span className="text-foreground/70 font-medium">Watch out. </span>
          {seed.watch_out}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
        {protocol.lead_days_before_camera} day lead
        {protocol.repeat_weeks ? ` · every ${protocol.repeat_weeks} weeks` : " · as needed"}
        {protocol.last_paid !== null
          ? ` · you paid ${currency} ${protocol.last_paid}`
          : seed
            ? ` · indicative EUR ${seed.indicative_eur[0]} to ${seed.indicative_eur[1]}, confirm when you book`
            : ""}
        {protocol.provider ? ` · ${protocol.provider}` : ""}
      </p>

      {error && <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-2">{error}</p>}

      {open && (
        <form action={save} className="mt-3 pt-3 border-t border-border grid gap-3">
          <input type="hidden" name="protocol_key" value={protocol.protocol_key} />
          <label className="flex items-center gap-2 text-[12px] text-foreground">
            <input type="checkbox" name="active" defaultChecked={protocol.active} className="accent-violet-600" />
            I actually do this
          </label>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Lead days" name="lead_days_before_camera" type="number" defaultValue={protocol.lead_days_before_camera} hint="clear days before filming" />
            <Field label="Repeat weeks" name="repeat_weeks" type="number" defaultValue={protocol.repeat_weeks ?? ""} hint="blank for one-off" />
            <Field label="Last done" name="last_done_at" type="date" defaultValue={protocol.last_done_at ?? ""} />
            <Field label={`Paid (${currency})`} name="last_paid" type="number" defaultValue={protocol.last_paid ?? ""} />
            <Field label={`Best quote (${currency})`} name="best_quote" type="number" defaultValue={protocol.best_quote ?? ""} />
            <Field label="Where" name="provider" defaultValue={protocol.provider ?? ""} />
          </div>

          <Field label="Notes" name="notes" defaultValue={protocol.notes ?? ""} hint="what to ask for, what went wrong last time" />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="h-8 rounded-md bg-violet-600 px-3 text-[12px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
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
    </article>
  )
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  hint,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string | number
  hint?: string
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="h-8 rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none focus:border-violet-500/60"
      />
      {hint && <span className="text-[10.5px] text-muted-foreground">{hint}</span>}
    </label>
  )
}
