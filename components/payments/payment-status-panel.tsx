"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, startTransition } from "react"
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type StatusState = {
  isActive: boolean
  statusLabel: string
  status: string
  error: string | null
}

async function readPaymentStatus() {
  const response = await fetch("/api/payments/status", { cache: "no-store" })
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    isActive?: boolean
    status?: string
    statusLabel?: string
  }

  return { response, payload }
}

export function PaymentStatusPanel({
  enabled,
  providerName,
  initialIsActive,
  initialStatus,
  initialStatusLabel,
}: {
  enabled: boolean
  providerName: string
  initialIsActive: boolean
  initialStatus: string
  initialStatusLabel: string
}) {
  const [state, setState] = useState<StatusState>({
    isActive: initialIsActive,
    statusLabel: initialStatusLabel,
    status: initialStatus,
    error: null,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { response, payload } = await readPaymentStatus()

      if (!response.ok) {
        setState((current) => ({
          ...current,
          error: payload.error ?? "We couldn't confirm payment yet.",
        }))
        return
      }

      setState({
        isActive: payload.isActive === true,
        status: payload.status ?? "pending",
        statusLabel: payload.statusLabel ?? "Pending",
        error: null,
      })
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "We couldn't confirm payment yet.",
      }))
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled || state.isActive) return

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      if (cancelled) return
      await refresh()
      attempts += 1
      if (!cancelled && attempts < 12) {
        timer = setTimeout(poll, 2500)
      }
    }

    timer = setTimeout(poll, 1200)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, refresh, state.isActive])

  if (!enabled) {
    return (
      <div className="rounded-[1.9rem] border border-amber-200 bg-amber-50/90 p-6 text-sm leading-7 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
        Billing is not configured yet. Add the Lemon Squeezy env vars, run the setup script, and this page will begin confirming payments automatically.
      </div>
    )
  }

  if (state.isActive) {
    return (
      <div className="rounded-[1.9rem] border border-emerald-200 bg-emerald-50/90 p-6 dark:border-emerald-400/20 dark:bg-emerald-500/10">
        <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-100">
          <CheckCircle2 className="h-6 w-6" />
          <div>
            <p className="text-sm uppercase tracking-[0.22em]">Access confirmed</p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.03em]">
              Your payment has been recorded.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-7 text-emerald-800/80 dark:text-emerald-100/80">
          {providerName} confirmed your access. You can head straight into the workspace.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-5 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
        >
          <Link href="/dashboard">Enter Juno</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-[1.9rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(148,163,184,0.12)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_24px_60px_rgba(2,8,14,0.3)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-sky-100 dark:text-slate-950">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-sky-100/55">
            Payment confirmation
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
            Waiting for checkout confirmation
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            We're checking the latest webhook from {providerName}. This usually takes a few seconds after checkout completes.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[1.3rem] border border-slate-200/80 bg-[#f7fbff] px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-[#0c2130]/70 dark:text-slate-200">
        Current status: <strong>{state.statusLabel}</strong>
      </div>

      {state.error ? (
        <div className="mt-4 rounded-[1.3rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {state.error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isRefreshing}
          onClick={() => {
            startTransition(() => {
              void refresh()
            })
          }}
          className="rounded-full border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Check again
            </>
          )}
        </Button>
        <Button
          asChild
          size="lg"
          className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
        >
          <Link href="/paywall">Back to checkout</Link>
        </Button>
      </div>
    </div>
  )
}
