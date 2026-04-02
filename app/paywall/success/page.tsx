import { redirect } from "next/navigation"
import { CheckCircle2, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import {
  JunoAccessShell,
  JunoLetterCopy,
  JunoLetterSignature,
} from "@/components/access/juno-access-shell"
import { PaymentStatusPanel } from "@/components/payments/payment-status-panel"
import {
  getBillingAccountForUser,
  getBillingStatusLabel,
  isBillingAccessActive,
} from "@/lib/payments/access"
import { getLemonSqueezySettings } from "@/lib/payments/lemonsqueezy"

export default async function PaywallSuccessPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const settings = getLemonSqueezySettings()
  const billing = await getBillingAccountForUser(user.id)

  const rail = (
    <>
      <div className="rounded-[2rem] border border-white/90 bg-white/70 p-7 shadow-[0_24px_70px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_80px_rgba(2,8,14,0.32)]">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
          What happens next
        </p>
        <div className="mt-5 space-y-4">
          <div className="rounded-[1.3rem] border border-slate-200/80 bg-[#fbfdff]/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-sky-100 dark:text-slate-950">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Checkout closes the loop
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  As soon as the webhook is received, the dashboard gate lifts and your account is
                  marked active.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.3rem] border border-slate-200/80 bg-[#fbfdff]/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-sky-100 dark:text-slate-950">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Access is enforced server-side
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                  The dashboard checks billing before rendering, so the payment gate stays real and
                  not just cosmetic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <article className="rounded-[2rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(248,251,255,0.76))] p-8 shadow-[0_30px_90px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,28,37,0.82),rgba(7,18,25,0.92))] dark:shadow-[0_32px_100px_rgba(2,8,14,0.45)]">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
          A note from Juno
        </p>
        <JunoLetterCopy>
          <p>Thank you for bringing the company in.</p>
          <p>
            The point of this workspace is not more noise. It is continuity: your context held in
            one place, your daily intelligence already shaped, your next move starting from a calmer
            desk.
          </p>
          <p>I'll be here when the lock opens.</p>
        </JunoLetterCopy>
        <JunoLetterSignature />
      </article>
    </>
  )

  return (
    <JunoAccessShell
      eyebrow="Payment confirmation"
      title="One more moment while we unlock your workspace."
      description="We're checking the latest billing event and opening access as soon as it lands."
      rail={rail}
      backHref="/paywall"
      backLabel="Back to checkout"
    >
      <PaymentStatusPanel
        enabled={settings.enabled}
        providerName={settings.provider}
        initialIsActive={isBillingAccessActive(billing)}
        initialStatus={billing?.status ?? "pending"}
        initialStatusLabel={getBillingStatusLabel(billing?.status ?? "pending")}
      />
    </JunoAccessShell>
  )
}
