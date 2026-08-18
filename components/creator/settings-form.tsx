"use client"

import { useState, useTransition } from "react"
import { updateCreatorSettings } from "@/lib/creator/actions"
import { SUPPORTED_CURRENCIES, type CreatorSettings } from "@/lib/creator/types"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>}
    </div>
  )
}

const inputClass =
  "h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-violet-500/60 disabled:opacity-60 disabled:cursor-not-allowed"

export function SettingsForm({
  settings,
  persisted,
}: {
  settings: CreatorSettings
  persisted: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCreatorSettings(formData)
      setMessage(result.ok ? { ok: true, text: "Saved." } : { ok: false, text: result.error })
    })
  }

  return (
    <form action={onSubmit} className="grid gap-6 max-w-[520px]">
      <Field
        label="TikTok handle"
        hint="Used to attribute the corpus and to identify you in outreach later."
      >
        <input
          name="tiktok_handle"
          defaultValue={settings.tiktok_handle ?? ""}
          placeholder="@yourhandle"
          disabled={!persisted}
          className={inputClass}
        />
      </Field>

      <Field
        label="Niche topics"
        hint="Comma-separated, up to 8. This is what your Researcher and Opportunities agents hunt in — replaced by your derived canon once your content is ingested."
      >
        <textarea
          name="niche_topics"
          defaultValue={settings.niche_topics.join(", ")}
          placeholder="e.g. personal finance, side hustles, fintech apps"
          disabled={!persisted}
          rows={2}
          className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </Field>

      <Field
        label="Your visual toolkit"
        hint="One per line, as 'Name — what it is good for'. The visual planner routes every shot to something on this list, so anything missing here produces shots you cannot build."
      >
        <textarea
          name="visual_tools"
          defaultValue={settings.visual_tools
            .map((t) => (t.good_for ? `${t.name} — ${t.good_for}` : t.name))
            .join("\n")}
          placeholder={
            "paperanimator.com — AI text on newspaper, good for recurring themes across decades\nElevenLabs — voice over, dubbing, sound design\nCapCut — editing, captions, transitions"
          }
          disabled={!persisted}
          rows={5}
          className="rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60 disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </Field>

      <Field label="Currency" hint="What rates in Worth are quoted in.">
        <select
          name="currency"
          defaultValue={settings.currency}
          disabled={!persisted}
          className={inputClass}
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </Field>

      {/* Above the CPM band on purpose. The CPM is an estimate about the market;
          this is a fact about a bank transfer, and it outranks the estimate
          everywhere the two disagree. */}
      <div className="grid gap-1.5">
        <label className="text-[12px] font-medium text-foreground">Highest fee actually paid</label>
        <input
          name="rate_floor"
          type="number"
          min={1}
          step={25}
          defaultValue={settings.rate_floor ?? ""}
          placeholder="e.g. 950"
          disabled={!persisted}
          className={inputClass}
          aria-label="Highest fee actually paid for one sponsored video"
        />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          What a brand has really paid you for a single video. No band ever quotes below it, and every
          line item on your rate card is a percentage of it. Leave blank if nothing has closed yet.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-[12px] font-medium text-foreground">CPM band</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            name="cpm_low"
            type="number"
            min={1}
            step={1}
            defaultValue={settings.cpm_low}
            disabled={!persisted}
            className={inputClass}
            aria-label="Lower CPM"
          />
          <input
            name="cpm_high"
            type="number"
            min={1}
            step={1}
            defaultValue={settings.cpm_high}
            disabled={!persisted}
            className={inputClass}
            aria-label="Upper CPM"
          />
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Paid per 1,000 views. This is the only figure in Worth not derived from your own data, which is
          why it lives here rather than inside the formula — calibrate it as you close real deals.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!persisted || pending}
          className="h-9 rounded-md bg-violet-600 px-4 text-[13px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {message && (
          <p
            className={
              message.ok
                ? "text-[12px] text-emerald-600 dark:text-emerald-400"
                : "text-[12px] text-red-600 dark:text-red-400"
            }
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  )
}
