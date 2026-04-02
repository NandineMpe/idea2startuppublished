"use client"

import { startTransition, useState } from "react"
import { Loader2, Lock, Sparkles, Ticket } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function HostedCheckoutCard({
  providerName,
  planName,
  planDescription,
  defaultPromoCode,
  currentStatusLabel,
  testMode,
}: {
  providerName: string
  planName: string
  planDescription: string
  defaultPromoCode: string
  currentStatusLabel: string
  testMode: boolean
}) {
  const router = useRouter()
  const [promoCode, setPromoCode] = useState(defaultPromoCode)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const openCheckout = () => {
    setError(null)
    setIsPending(true)

    startTransition(async () => {
      try {
        const response = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            promoCode: promoCode.trim() || undefined,
          }),
        })

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string
          redirectTo?: string
          url?: string
        }

        if (response.status === 409 && payload.redirectTo) {
          router.push(payload.redirectTo)
          return
        }

        if (!response.ok || !payload.url) {
          setError(payload.error ?? "We couldn't create a checkout right now.")
          return
        }

        window.location.assign(payload.url)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "Checkout failed to start.")
      } finally {
        setIsPending(false)
      }
    })
  }

  return (
    <div className="rounded-[1.9rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(148,163,184,0.12)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_24px_60px_rgba(2,8,14,0.3)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.22em] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-sky-100/60">
          <Sparkles className="h-3.5 w-3.5" />
          Founding access
        </span>
        <span className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white dark:bg-sky-100 dark:text-slate-950">
          {currentStatusLabel}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
          {planName}
        </h2>
        <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
          {planDescription}
        </p>
      </div>

      <div className="mt-6 rounded-[1.4rem] border border-slate-200/80 bg-[#f7fbff] p-4 dark:border-white/10 dark:bg-[#0c2130]/70">
        <label className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-sky-100/55">
          <Ticket className="h-3.5 w-3.5" />
          Promo code
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder={defaultPromoCode}
            className="h-12 rounded-full border-slate-200 bg-white px-4 text-slate-900 dark:border-white/10 dark:bg-[#091924] dark:text-white"
          />
          <Button
            type="button"
            size="lg"
            onClick={openCheckout}
            disabled={isPending}
            className="h-12 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening checkout
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Continue to secure checkout
              </>
            )}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
          {defaultPromoCode} is prefilled for now, and you can still edit or replace it before paying.
        </p>
        {testMode ? (
          <p className="mt-2 text-xs leading-6 text-amber-700 dark:text-amber-300">
            Billing is in Lemon Squeezy test mode, so use test checkout details before going live.
          </p>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-sky-100/55">
        <Lock className="h-3.5 w-3.5" />
        Secure checkout by {providerName}
      </div>
    </div>
  )
}
