import Link from "next/link"
import localFont from "next/font/local"
import { redirect } from "next/navigation"
import { Lock, Sparkles } from "lucide-react"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { JunoAuthForm } from "@/components/access/juno-auth-form"

const casualHuman = localFont({
  src: "../../app/fonts/CasualHuman.otf",
  display: "swap",
})

const casualHumanBold = localFont({
  src: "../../app/fonts/CasualHuman-Bold.otf",
  display: "swap",
})

const editorialHeading = {
  fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
}

function BlueDotMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full bg-blue-500 shadow-[0_0_0_10px_rgba(59,130,246,0.09),0_18px_40px_rgba(37,99,235,0.26)] ${className}`}
    />
  )
}

function ResortDarkBackdrop() {
  return (
    <div aria-hidden="true" className="absolute inset-0 hidden dark:block">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(28,71,95,0.48),rgba(7,19,27,0.96)_42%,rgba(4,11,17,1))]" />
      <div className="absolute left-[-8rem] top-[-5rem] h-[20rem] w-[34rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(159,207,227,0.2),rgba(159,207,227,0.08)_42%,transparent_72%)] blur-3xl animate-resort-cloud-drift" />
      <div className="absolute right-[-10rem] top-[7rem] h-[18rem] w-[30rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(111,166,190,0.16),rgba(111,166,190,0.05)_45%,transparent_74%)] blur-3xl animate-resort-cloud-drift-reverse" />
      <div
        className="absolute inset-[-10%] animate-resort-shadow-drift opacity-45 mix-blend-multiply blur-[1px]"
        style={{
          backgroundImage: "url('/juno/resort-shadow-overlay.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div
        className="absolute inset-[-12%] animate-resort-shadow-drift-reverse opacity-20 mix-blend-multiply blur-xl"
        style={{
          backgroundImage: "url('/juno/resort-shadow-overlay.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(180deg,transparent,rgba(4,11,17,0.12)_25%,rgba(2,9,15,0.78))]" />
    </div>
  )
}

function messageTone(message?: string) {
  if (!message) return ""

  const normalized = message.toLowerCase()
  if (normalized.includes("check your email") || normalized.includes("account is ready")) {
    return "border-sky-200 bg-sky-50/90 text-sky-950 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100"
  }

  return "border-rose-200 bg-rose-50/90 text-rose-950 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100"
}

export async function JunoAuthPage({
  pagePath,
  message,
  redirectAfterAuth,
}: {
  pagePath: "/" | "/login"
  message?: string
  /** Safe internal path only (e.g. /join/abc). Defaults to /dashboard. */
  redirectAfterAuth?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(
      redirectAfterAuth?.startsWith("/") && !redirectAfterAuth.startsWith("//")
        ? redirectAfterAuth
        : "/dashboard",
    )
  }

  const afterAuthPath =
    redirectAfterAuth?.startsWith("/") && !redirectAfterAuth.startsWith("//")
      ? redirectAfterAuth
      : "/dashboard"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef3fb] text-slate-950 transition-colors duration-700 dark:bg-[#061219] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(238,243,251,0.98)_54%,rgba(230,238,249,1))]" />
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_50%_0%,rgba(180,214,248,0.7),transparent_56%)]" />
        <div
          className="absolute right-[-7rem] top-[-3rem] h-[30rem] w-[30rem] rounded-full opacity-60 blur-3xl"
          style={{
            backgroundImage: "url('/juno/calm-gradient.png')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute left-[-6rem] top-20 h-72 w-72 rounded-full bg-sky-100/80 blur-3xl" />
        <div className="absolute right-[12%] top-[22rem] h-72 w-72 rounded-full bg-blue-100/70 blur-3xl" />
        <div className="absolute inset-x-0 top-[30rem] h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
        <ResortDarkBackdrop />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-white/90 bg-white/70 px-3 py-2 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_rgba(2,8,14,0.4)]">
          <Link href={pagePath} className="flex items-center gap-3 rounded-full px-2 py-1">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full">
              <BlueDotMark className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-sky-100/55">
                Founder OS
              </p>
              <p className={`${casualHumanBold.className} text-2xl leading-none text-slate-950 dark:text-white`}>
                Juno AI
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <Button
              asChild
              variant="outline"
              className="hidden rounded-full border-slate-300/80 bg-white/70 px-5 text-slate-900 hover:bg-white md:inline-flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </header>

        <main className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="relative overflow-hidden rounded-[2.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,249,255,0.8))] p-8 shadow-[0_30px_90px_rgba(148,163,184,0.15)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,28,37,0.82),rgba(7,18,25,0.92))] dark:shadow-[0_32px_100px_rgba(2,8,14,0.46)] md:p-10 lg:p-12">
            <div className="absolute right-[-5rem] top-[-5rem] h-56 w-56 rounded-full border border-sky-200/70 bg-white/35 blur-sm dark:border-sky-200/15 dark:bg-white/[0.05]" />
            <div className="absolute right-10 top-14 flex h-28 w-28 items-center justify-center rounded-full border border-sky-200/80 bg-white/65 shadow-[0_24px_70px_rgba(59,130,246,0.2)] dark:border-sky-100/15 dark:bg-white/[0.05]">
              <span className="absolute inset-4 rounded-full border border-sky-200/80 dark:border-sky-100/15" />
              <BlueDotMark className="h-10 w-10" />
            </div>

            <div className="relative max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-sky-100/55">
                <Sparkles className="h-3.5 w-3.5" />
                The blue room
              </div>

              <article className="mt-6 rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(243,248,255,0.82))] p-7 shadow-[0_24px_70px_rgba(148,163,184,0.12)] transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(9,25,34,0.85),rgba(8,19,28,0.92))] dark:shadow-[0_24px_80px_rgba(2,8,14,0.36)]">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
                  A note from
                </p>
                <p className={`${casualHumanBold.className} mt-4 text-5xl leading-none text-slate-950 dark:text-white`}>
                  Juno AI
                </p>

                <div className={`${casualHuman.className} mt-6 space-y-5 text-[1.03rem] leading-8 text-slate-700 dark:text-slate-200`}>
                  <p>Dear founder,</p>
                  <p>
                    You already carry too much of the company in your head: the strategy, the
                    latest notes, the founder story, and the priorities that changed yesterday.
                  </p>
                  <p>
                    I am here to help hold that context with you and turn it into a calmer, sharper
                    starting point every morning.
                  </p>
                </div>

                <div className="mt-8 border-t border-slate-200/80 pt-5 dark:border-white/10">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-sky-100/55">
                    With you,
                  </p>
                  <p className={`${casualHumanBold.className} mt-3 text-4xl leading-none text-slate-950 dark:text-white`}>
                    Juno AI
                  </p>
                </div>
              </article>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2.4rem] border border-slate-200/80 bg-white/80 p-8 shadow-[0_26px_70px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[#071923]/90 dark:shadow-[0_28px_90px_rgba(2,8,14,0.42)] sm:p-9">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-sky-100/55">
                <Lock className="h-3.5 w-3.5" />
                Secure founder access
              </div>

              <h2
                style={editorialHeading}
                className="mt-5 text-4xl leading-tight tracking-[-0.045em] text-slate-950 dark:text-white"
              >
                Sign in or create your account.
              </h2>

              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                Returning founders can get back in fast with the same front door.
              </p>

              <JunoAuthForm
                pagePath={pagePath}
                afterAuthPath={afterAuthPath}
                message={message}
                messageBannerClassName={message ? messageTone(message) : ""}
              />
            </section>
          </aside>
        </main>
      </div>
    </div>
  )
}
