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
