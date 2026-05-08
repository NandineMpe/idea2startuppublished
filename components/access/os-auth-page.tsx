import Link from "next/link"
import localFont from "next/font/local"
import { redirect } from "next/navigation"
import { Lock, Sparkles, Palette, Briefcase, Rocket } from "lucide-react"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"
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

export type OsMode = "founder" | "creator" | "career"

interface OsConfig {
  label: string
  tagline: string
  headerLabel: string
  accentDot: string
  accentGlow: string
  gradientLight: string
  gradientDark: string
  orbLight: string
  orbDark: string
  noteGreeting: string
  noteBody: string[]
  formLabel: string
  formDescription: string
  placeholder: string
  dashboardPath: string
  loginPath: string
  icon: typeof Rocket
}

const osConfigs: Record<OsMode, OsConfig> = {
  founder: {
    label: "Founder OS",
    tagline: "The blue room",
    headerLabel: "Founder OS",
    accentDot: "bg-blue-500 shadow-[0_0_0_10px_rgba(59,130,246,0.09),0_18px_40px_rgba(37,99,235,0.26)]",
    accentGlow: "border-sky-200/70 bg-white/35 dark:border-sky-200/15 dark:bg-white/[0.05]",
    gradientLight: "bg-[radial-gradient(circle_at_50%_0%,rgba(180,214,248,0.7),transparent_56%)]",
    gradientDark: "bg-[radial-gradient(circle_at_top,rgba(28,71,95,0.48),rgba(7,19,27,0.96)_42%,rgba(4,11,17,1))]",
    orbLight: "bg-sky-100/80",
    orbDark: "bg-blue-100/70",
    noteGreeting: "Dear founder,",
    noteBody: [
      "You already carry too much of the company in your head: the strategy, the latest notes, the founder story, and the priorities that changed yesterday.",
      "I am here to help hold that context with you and turn it into a calmer, sharper starting point every morning.",
    ],
    formLabel: "Secure founder access",
    formDescription: "Returning founders can get back in fast with the same front door.",
    placeholder: "founder@company.com",
    dashboardPath: "/dashboard",
    loginPath: "/login",
    icon: Rocket,
  },
  creator: {
    label: "Creator OS",
    tagline: "The violet room",
    headerLabel: "Creator OS",
    accentDot: "bg-violet-500 shadow-[0_0_0_10px_rgba(139,92,246,0.09),0_18px_40px_rgba(109,40,217,0.26)]",
    accentGlow: "border-violet-200/70 bg-white/35 dark:border-violet-200/15 dark:bg-white/[0.05]",
    gradientLight: "bg-[radial-gradient(circle_at_50%_0%,rgba(196,181,253,0.7),transparent_56%)]",
    gradientDark: "bg-[radial-gradient(circle_at_top,rgba(76,29,149,0.48),rgba(15,5,32,0.96)_42%,rgba(8,3,18,1))]",
    orbLight: "bg-violet-100/80",
    orbDark: "bg-purple-100/70",
    noteGreeting: "Dear creator,",
    noteBody: [
      "Your ideas move faster than you can capture them: the content calendar, the audience insights, the brand voice, and the collaborations that just landed.",
      "I am here to help organize that creative energy and turn it into a focused, productive rhythm every day.",
    ],
    formLabel: "Secure creator access",
    formDescription: "Returning creators can pick up right where they left off.",
    placeholder: "creator@studio.com",
    dashboardPath: "/creator/dashboard",
    loginPath: "/creator",
    icon: Palette,
  },
  career: {
    label: "Career OS",
    tagline: "The emerald room",
    headerLabel: "Career OS",
    accentDot: "bg-emerald-500 shadow-[0_0_0_10px_rgba(16,185,129,0.09),0_18px_40px_rgba(5,150,105,0.26)]",
    accentGlow: "border-emerald-200/70 bg-white/35 dark:border-emerald-200/15 dark:bg-white/[0.05]",
    gradientLight: "bg-[radial-gradient(circle_at_50%_0%,rgba(167,243,208,0.7),transparent_56%)]",
    gradientDark: "bg-[radial-gradient(circle_at_top,rgba(6,78,59,0.48),rgba(5,22,17,0.96)_42%,rgba(3,12,9,1))]",
    orbLight: "bg-emerald-100/80",
    orbDark: "bg-teal-100/70",
    noteGreeting: "Dear professional,",
    noteBody: [
      "Your career is more than a resume: the skills you are building, the network you are growing, the opportunities that matter, and the goals that keep evolving.",
      "I am here to help you navigate that journey with clarity and turn every step into meaningful progress.",
    ],
    formLabel: "Secure career access",
    formDescription: "Returning professionals can get back in fast.",
    placeholder: "you@email.com",
    dashboardPath: "/career/dashboard",
    loginPath: "/career",
    icon: Briefcase,
  },
}

function DotMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-full ${className}`}
    />
  )
}

function DarkBackdrop({ mode }: { mode: OsMode }) {
  const config = osConfigs[mode]
  const cloudColors = mode === "founder"
    ? { c1: "rgba(159,207,227,0.2)", c1f: "rgba(159,207,227,0.08)", c2: "rgba(111,166,190,0.16)", c2f: "rgba(111,166,190,0.05)" }
    : mode === "creator"
    ? { c1: "rgba(196,181,253,0.2)", c1f: "rgba(196,181,253,0.08)", c2: "rgba(167,139,250,0.16)", c2f: "rgba(167,139,250,0.05)" }
    : { c1: "rgba(167,243,208,0.2)", c1f: "rgba(167,243,208,0.08)", c2: "rgba(110,231,183,0.16)", c2f: "rgba(110,231,183,0.05)" }

  return (
    <div aria-hidden="true" className="absolute inset-0 hidden dark:block">
      <div className={`absolute inset-0 ${config.gradientDark}`} />
      <div
        className="absolute left-[-8rem] top-[-5rem] h-[20rem] w-[34rem] rounded-full blur-3xl animate-resort-cloud-drift"
        style={{ background: `radial-gradient(ellipse at center, ${cloudColors.c1}, ${cloudColors.c1f} 42%, transparent 72%)` }}
      />
      <div
        className="absolute right-[-10rem] top-[7rem] h-[18rem] w-[30rem] rounded-full blur-3xl animate-resort-cloud-drift-reverse"
        style={{ background: `radial-gradient(ellipse at center, ${cloudColors.c2}, ${cloudColors.c2f} 45%, transparent 74%)` }}
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

export async function OsAuthPage({
  mode,
  message,
  redirectAfterAuth,
}: {
  mode: OsMode
  message?: string
  redirectAfterAuth?: string
}) {
  const config = osConfigs[mode]
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect(
      redirectAfterAuth?.startsWith("/") && !redirectAfterAuth.startsWith("//")
        ? redirectAfterAuth
        : config.dashboardPath,
    )
  }

  const afterAuthPath =
    redirectAfterAuth?.startsWith("/") && !redirectAfterAuth.startsWith("//")
      ? redirectAfterAuth
      : config.dashboardPath

  const pagePath = config.loginPath
  const Icon = config.icon

  const lightBg = mode === "founder"
    ? "bg-[#eef3fb]"
    : mode === "creator"
    ? "bg-[#f3eefb]"
    : "bg-[#eefbf3]"

  const darkBg = mode === "founder"
    ? "dark:bg-[#061219]"
    : mode === "creator"
    ? "dark:bg-[#0f0519]"
    : "dark:bg-[#051912]"

  const labelColor = mode === "founder"
    ? "text-slate-500 dark:text-sky-100/55"
    : mode === "creator"
    ? "text-slate-500 dark:text-violet-100/55"
    : "text-slate-500 dark:text-emerald-100/55"

  return (
    <div className={`relative min-h-screen overflow-hidden ${lightBg} text-slate-950 transition-colors duration-700 ${darkBg} dark:text-slate-100`}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.94),rgba(238,243,251,0.98)_54%,rgba(230,238,249,1))]" />
        <div className={`absolute inset-x-0 top-0 h-[36rem] ${config.gradientLight}`} />
        <div className={`absolute left-[-6rem] top-20 h-72 w-72 rounded-full ${config.orbLight} blur-3xl`} />
        <div className={`absolute right-[12%] top-[22rem] h-72 w-72 rounded-full ${config.orbDark} blur-3xl`} />
        <div className="absolute inset-x-0 top-[30rem] h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent" />
        <DarkBackdrop mode={mode} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-white/90 bg-white/70 px-3 py-2 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_rgba(2,8,14,0.4)]">
          <Link href={pagePath} className="flex items-center gap-3 rounded-full px-2 py-1">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full">
              <DotMark className={`h-5 w-5 ${config.accentDot}`} />
            </span>
            <div>
              <p className={`text-xs uppercase tracking-[0.28em] ${labelColor}`}>
                {config.headerLabel}
              </p>
              <p className={`${casualHumanBold.className} text-2xl leading-none text-slate-950 dark:text-white`}>
                Juno AI
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <LandingThemeToggle />
            <Link
              href="/"
              className="hidden rounded-full border border-slate-300/80 bg-white/70 px-5 py-2 text-sm text-slate-900 hover:bg-white md:inline-flex dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10"
            >
              All modes
            </Link>
          </div>
        </header>

        <main className="grid flex-1 gap-6 py-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <section className="relative overflow-hidden rounded-[2.6rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,249,255,0.8))] p-8 shadow-[0_30px_90px_rgba(148,163,184,0.15)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,28,37,0.82),rgba(7,18,25,0.92))] dark:shadow-[0_32px_100px_rgba(2,8,14,0.46)] md:p-10 lg:p-12">
            <div className={`absolute right-[-5rem] top-[-5rem] h-56 w-56 rounded-full border ${config.accentGlow} blur-sm`} />
            <div className={`absolute right-10 top-14 flex h-28 w-28 items-center justify-center rounded-full border ${config.accentGlow} shadow-[0_24px_70px_rgba(59,130,246,0.2)]`}>
              <span className={`absolute inset-4 rounded-full border ${config.accentGlow}`} />
              <DotMark className={`h-10 w-10 ${config.accentDot}`} />
            </div>

            <div className="relative max-w-2xl">
              <div className={`inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-xs uppercase tracking-[0.28em] ${labelColor} dark:border-white/10 dark:bg-white/[0.05]`}>
                <Sparkles className="h-3.5 w-3.5" />
                {config.tagline}
              </div>

              <article className="mt-6 rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(243,248,255,0.82))] p-7 shadow-[0_24px_70px_rgba(148,163,184,0.12)] transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(9,25,34,0.85),rgba(8,19,28,0.92))] dark:shadow-[0_24px_80px_rgba(2,8,14,0.36)]">
                <p className={`text-xs uppercase tracking-[0.32em] ${labelColor}`}>
                  A note from
                </p>
                <p className={`${casualHumanBold.className} mt-4 text-5xl leading-none text-slate-950 dark:text-white`}>
                  Juno AI
                </p>

                <div className={`${casualHuman.className} mt-6 space-y-5 text-[1.03rem] leading-8 text-slate-700 dark:text-slate-200`}>
                  <p>{config.noteGreeting}</p>
                  {config.noteBody.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>

                <div className="mt-8 border-t border-slate-200/80 pt-5 dark:border-white/10">
                  <p className={`text-xs uppercase tracking-[0.24em] ${labelColor}`}>
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
              <div className={`inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/80 px-4 py-2 text-xs uppercase tracking-[0.28em] ${labelColor} dark:border-white/10 dark:bg-white/[0.04]`}>
                <Lock className="h-3.5 w-3.5" />
                {config.formLabel}
              </div>

              <h2
                style={editorialHeading}
                className="mt-5 text-4xl leading-tight tracking-[-0.045em] text-slate-950 dark:text-white"
              >
                Sign in or create your account.
              </h2>

              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300">
                {config.formDescription}
              </p>

              <JunoAuthForm
                pagePath={pagePath}
                afterAuthPath={afterAuthPath}
                message={message}
                messageBannerClassName={message ? messageTone(message) : ""}
                namePlaceholder={mode === "founder" ? "Founder name" : mode === "creator" ? "Creator name" : "Your name"}
                emailPlaceholder={config.placeholder}
              />
            </section>
          </aside>
        </main>
      </div>
    </div>
  )
}
