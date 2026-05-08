import Link from "next/link"
import localFont from "next/font/local"
import { ArrowRight, Rocket, Palette, Briefcase } from "lucide-react"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"

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
      <div className="absolute inset-x-0 bottom-0 h-72 bg-[linear-gradient(180deg,transparent,rgba(4,11,17,0.12)_25%,rgba(2,9,15,0.78))]" />
    </div>
  )
}

const osOptions = [
  {
    name: "Founder OS",
    slug: "founder",
    href: "/login",
    icon: Rocket,
    color: "blue",
    accentBg: "bg-blue-500",
    accentText: "text-blue-600 dark:text-blue-400",
    accentBorder: "border-blue-200 dark:border-blue-500/20",
    accentGlow: "shadow-[0_0_0_8px_rgba(59,130,246,0.08),0_14px_32px_rgba(37,99,235,0.18)]",
    hoverBg: "hover:bg-blue-50/80 dark:hover:bg-blue-500/[0.06]",
    description: "Your calm operating system for company context, strategy, and founder workflows.",
    tagline: "For founders building companies",
    status: "Live",
    statusColor: "bg-blue-500",
  },
  {
    name: "Creator OS",
    slug: "creator",
    href: "/creator",
    icon: Palette,
    color: "violet",
    accentBg: "bg-violet-500",
    accentText: "text-violet-600 dark:text-violet-400",
    accentBorder: "border-violet-200 dark:border-violet-500/20",
    accentGlow: "shadow-[0_0_0_8px_rgba(139,92,246,0.08),0_14px_32px_rgba(109,40,217,0.18)]",
    hoverBg: "hover:bg-violet-50/80 dark:hover:bg-violet-500/[0.06]",
    description: "Your creative command center for content, audience, and creator workflows.",
    tagline: "For creators building audiences",
    status: "Coming soon",
    statusColor: "bg-violet-500",
  },
  {
    name: "Career OS",
    slug: "career",
    href: "/career",
    icon: Briefcase,
    color: "emerald",
    accentBg: "bg-emerald-500",
    accentText: "text-emerald-600 dark:text-emerald-400",
    accentBorder: "border-emerald-200 dark:border-emerald-500/20",
    accentGlow: "shadow-[0_0_0_8px_rgba(16,185,129,0.08),0_14px_32px_rgba(5,150,105,0.18)]",
    hoverBg: "hover:bg-emerald-50/80 dark:hover:bg-emerald-500/[0.06]",
    description: "Your intelligent career co-pilot for job search, networking, and career growth.",
    tagline: "For professionals building careers",
    status: "Coming soon",
    statusColor: "bg-emerald-500",
  },
] as const

export function OsPortalPage() {
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
        <ResortDarkBackdrop />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10">
        <header className="flex items-center justify-between gap-4 rounded-[1.7rem] border border-white/90 bg-white/70 px-3 py-2 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_rgba(2,8,14,0.4)]">
          <div className="flex items-center gap-3 rounded-full px-2 py-1">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full">
              <BlueDotMark className="h-5 w-5" />
            </span>
            <div>
              <p className={`${casualHumanBold.className} text-2xl leading-none text-slate-950 dark:text-white`}>
                Juno AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LandingThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-12 lg:py-16">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
              Choose your operating system
            </p>
            <h1
              style={editorialHeading}
              className="mt-4 text-4xl leading-tight tracking-[-0.045em] text-slate-950 dark:text-white sm:text-5xl"
            >
              Welcome to Juno AI
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-slate-600 dark:text-slate-300">
              One platform, three modes. Pick the operating system that fits where you are right now.
            </p>
          </div>

          <div className="mt-12 grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {osOptions.map((os) => {
              const Icon = os.icon
              return (
                <Link
                  key={os.slug}
                  href={os.href}
                  className={`group relative flex flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/80 p-8 shadow-[0_26px_70px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-all duration-300 dark:border-white/10 dark:bg-[#071923]/90 dark:shadow-[0_28px_90px_rgba(2,8,14,0.42)] ${os.hoverBg}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`inline-flex h-14 w-14 items-center justify-center rounded-2xl ${os.accentBg}/10 ${os.accentGlow}`}>
                      <span className={`inline-block h-5 w-5 rounded-full ${os.accentBg}`} />
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${os.status === "Live" ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${os.status === "Live" ? "bg-blue-500 animate-pulse" : "bg-slate-400 dark:bg-slate-500"}`} />
                      {os.status}
                    </span>
                  </div>

                  <div className="mt-6">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-sky-100/55">
                      {os.tagline}
                    </p>
                    <h2 className={`${casualHumanBold.className} mt-2 text-3xl leading-none text-slate-950 dark:text-white`}>
                      {os.name}
                    </h2>
                  </div>

                  <p className="mt-4 flex-1 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {os.description}
                  </p>

                  <div className={`mt-6 inline-flex items-center gap-2 text-sm font-medium ${os.accentText} transition-transform duration-200 group-hover:translate-x-1`}>
                    Enter {os.name.split(" ")[0]} OS
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </Link>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
