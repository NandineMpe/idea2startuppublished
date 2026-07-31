"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Compass } from "lucide-react"
import { saveTrajectory } from "@/lib/creator/trajectory/actions"
import { Disclosure } from "@/components/creator/disclosure"
import type { CreatorTrajectory } from "@/lib/creator/types"

const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-violet-500/60"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[12px] font-medium text-foreground">{label}</label>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{hint}</p>
      {children}
    </div>
  )
}

/**
 * Where the creator says they are going.
 *
 * Kept short on purpose. This is the one place in the product the creator writes
 * rather than reviews, and a long form is a form that stays empty. Five fields,
 * only the first required.
 */
export function TrajectoryForm({ trajectory }: { trajectory: CreatorTrajectory | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null)
      setSaved(false)
      const result = await saveTrajectory(formData)
      if (!result.ok) setError(result.error)
      else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  const declared = Boolean(trajectory?.north_star)

  return (
    <section className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <Compass className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <h2 className="text-[13px] font-semibold text-foreground">Where I am going</h2>
      </div>
      <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed max-w-[680px]">
        Your canon is derived from what you have already published, and left on its own it makes
        every agent argue from precedent. This is the other half. What you write here outranks the
        canon in every agent prompt on the desk.
      </p>

      <form action={onSubmit} className="grid gap-4 max-w-[720px]">
        <Field
          label="North star"
          hint="The position you want to hold. One or two sentences, in your words."
        >
          <textarea
            name="north_star"
            rows={3}
            required
            defaultValue={trajectory?.north_star ?? ""}
            placeholder="The person professionals go to for how AI is actually moving and how to get involved, starting from finance, audit and accounting."
            className={FIELD}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Audience you need" hint="Who has to be in the room for this to be worth anything.">
            <textarea
              name="target_audience"
              rows={3}
              defaultValue={trajectory?.target_audience ?? ""}
              placeholder="Finance, audit and accounting professionals, and the people who decide what their firms adopt."
              className={FIELD}
            />
          </Field>

          <Field
            label="What the position serves"
            hint="The commercial engine behind it. This changes what counts as a good deal."
          >
            <textarea
              name="what_it_serves"
              rows={3}
              defaultValue={trajectory?.what_it_serves ?? ""}
              placeholder="I am building Augentik and need that audience to know me before they need the product."
              className={FIELD}
            />
          </Field>
        </div>

        <Disclosure label="Sharpen it (optional)">
          <div className="grid gap-4">
            <Field
              label="Arguments you want to own"
              hint="One per line. The specific takes you want attributed to you, not just topics."
            >
              <textarea
                name="positions_to_claim"
                rows={4}
                defaultValue={(trajectory?.positions_to_claim ?? []).join("\n")}
                placeholder={"AI accountability is an audit problem before it is a policy problem\nProfessionals adopt AI faster than their institutions permit"}
                className={FIELD}
              />
            </Field>

            <Field
              label="Off strategy"
              hint="One per line. What you do not want handed to you, however well it would perform."
            >
              <textarea
                name="off_strategy"
                rows={3}
                defaultValue={(trajectory?.off_strategy ?? []).join("\n")}
                placeholder={"Generic AI tool roundups\nHot takes with no primary source"}
                className={FIELD}
              />
            </Field>

            <Field label="Horizon" hint="Months you are planning against.">
              <input
                name="horizon_months"
                type="number"
                min={1}
                max={60}
                defaultValue={trajectory?.horizon_months ?? 12}
                className={`${FIELD} max-w-[120px]`}
              />
            </Field>
          </div>
        </Disclosure>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-md bg-violet-600 px-4 text-[13px] font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {pending ? "Saving…" : declared ? "Update" : "Set my trajectory"}
          </button>
          {saved && <span className="text-[12px] text-emerald-600 dark:text-emerald-400">Saved.</span>}
          {error && <span className="text-[12px] text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </form>
    </section>
  )
}
