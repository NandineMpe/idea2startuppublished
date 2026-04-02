import { redirect } from "next/navigation"
import { BrainCircuit, FolderHeart, RadioTower, Ticket } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { JunoAccessShell, JunoLetterCopy } from "@/components/access/juno-access-shell"
import { HostedCheckoutCard } from "@/components/payments/hosted-checkout-card"
import {
  getBillingAccountForUser,
  getBillingStatusLabel,
  isBillingAccessActive,
} from "@/lib/payments/access"
import { getLemonSqueezySettings } from "@/lib/payments/lemonsqueezy"

const accessPillars = [
  {
    icon: FolderHeart,
    title: "Keep the company context together",
    body:
      "Strategy, notes, assets, founder voice, and moving decisions live in one place instead of being rebuilt from scratch every morning.",
  },
  {
    icon: RadioTower,
    title: "Wake up to daily intelligence",
    body:
      "Juno turns your saved context into a calmer read on what changed overnight and what matters next.",
  },
  {
    icon: BrainCircuit,
    title: "Move the next workflow forward",
    body:
      "Research, planning, and execution stay close to the context that shaped them, so motion stays coherent.",
  },
]

export default async function PaywallPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const settings = getLemonSqueezySettings()
  const billing = await getBillingAccountForUser(user.id)

  if (settings.enabled && isBillingAccessActive(billing)) {
    redirect("/dashboard")
  }

  const rail = (
    <>
      <div className="rounded-[2rem] border border-white/90 bg-white/70 p-7 shadow-[0_24px_70px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_80px_rgba(2,8,14,0.32)]">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
          What unlocks
        </p>
        <div className="mt-5 space-y-4">
          {accessPillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-[1.3rem] border border-slate-200/80 bg-[#fbfdff]/90 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-sky-100 dark:text-slate-950">
                  <pillar.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {pillar.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <article className="rounded-[2rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(248,251,255,0.76))] p-8 shadow-[0_30px_90px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,28,37,0.82),rgba(7,18,25,0.92))] dark:shadow-[0_32px_100px_rgba(2,8,14,0.45)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-sky-100/55">
          <Ticket className="h-3.5 w-3.5" />
          Promo ready
        </div>
        <JunoLetterCopy>
          <p>USEJUNO is prefilled for now, and you can still change it before paying.</p>
          <p>
            The hosted checkout stays quick to deploy: create the variant in Lemon Squeezy, run
            the setup script, and the webhook will unlock access as soon as payment lands.
          </p>
        </JunoLetterCopy>
      </article>
    </>
  )

  return (
    <JunoAccessShell
      eyebrow="Founding access"
      title="Bring the company in. Let Juno brief you every morning."
      description="Start with a secure hosted checkout, then come back into the workspace with access unlocked."
      rail={rail}
      backHref="/login"
      backLabel="Back to sign in"
    >
      {settings.enabled ? (
        <HostedCheckoutCard
          providerName={settings.provider}
          planName={settings.planName}
          planDescription={settings.planDescription}
          defaultPromoCode={billing?.promoCode ?? settings.defaultPromoCode}
          currentStatusLabel={getBillingStatusLabel(billing?.status ?? "pending")}
          testMode={settings.testMode}
        />
      ) : (
        <div className="rounded-[1.9rem] border border-amber-200 bg-amber-50/90 p-6 text-sm leading-7 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
          Billing isn't configured yet. Add `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`,
          `LEMONSQUEEZY_VARIANT_ID`, and `LEMONSQUEEZY_WEBHOOK_SECRET`, then run
          `npm run billing:setup:juno` to create the webhook and optional `USEJUNO` promo code.
        </div>
      )}
    </JunoAccessShell>
  )
}
