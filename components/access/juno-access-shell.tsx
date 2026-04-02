import Link from "next/link"
import localFont from "next/font/local"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

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

function JunoDotMark({ className = "" }: { className?: string }) {
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

export function JunoLetterSignature() {
  return (
    <div className="mt-8 border-t border-slate-200/80 pt-5 dark:border-white/10">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-sky-100/55">
        With you,
      </p>
      <p className={`${casualHumanBold.className} mt-3 text-4xl leading-none text-slate-900 dark:text-white`}>
        Juno AI
      </p>
    </div>
  )
}

export function JunoLetterCopy({ children }: { children: ReactNode }) {
  return (
    <div className={`${casualHuman.className} mt-6 space-y-5 text-[1.02rem] leading-8 text-slate-700 dark:text-slate-200`}>
      {children}
    </div>
  )
}

export function JunoAccessShell({
  eyebrow,
  title,
  description,
  children,
  rail,
  backHref = "/",
  backLabel = "Back to home",
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  rail: ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef3f9] text-slate-950 transition-colors duration-700 dark:bg-[#061219] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(238,243,249,0.96)_52%,rgba(232,239,248,1))]" />
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_50%_0%,rgba(196,220,247,0.6),transparent_58%)]" />
        <div
          className="absolute right-[-5rem] top-[-3rem] h-[28rem] w-[28rem] rounded-full opacity-55 blur-3xl"
          style={{
            backgroundImage: "url('/juno/calm-gradient.png')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        />
        <div className="absolute left-[-8rem] top-24 h-80 w-80 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="absolute right-[-6rem] top-32 h-96 w-96 rounded-full bg-blue-50/80 blur-3xl" />
        <div className="absolute inset-x-0 top-[28rem] h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />
        <ResortDarkBackdrop />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-5 sm:px-6 lg:px-10">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-[1.6rem] border border-white/90 bg-white/65 px-3 py-2 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_rgba(2,8,14,0.4)]">
          <Link href="/" className="flex items-center gap-3 rounded-full px-2 py-1 text-sm text-slate-700 hover:bg-white/60 dark:text-slate-200 dark:hover:bg-white/10">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full">
              <JunoDotMark className="h-5 w-5" />
            </span>
            <span className="font-medium">Juno</span>
          </Link>

          <Link
            href={backHref}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </header>

        <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 py-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <section className="rounded-[2.3rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,251,255,0.78))] p-8 shadow-[0_30px_90px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,28,37,0.82),rgba(7,18,25,0.92))] dark:shadow-[0_32px_100px_rgba(2,8,14,0.45)] md:p-10">
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
              {eyebrow}
            </p>
            <h1
              style={editorialHeading}
              className="mt-5 max-w-3xl text-4xl leading-tight tracking-[-0.045em] text-slate-950 dark:text-white md:text-5xl"
            >
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              {description}
            </p>

            <div className="mt-8">{children}</div>
          </section>

          <aside className="space-y-6">{rail}</aside>
        </main>
      </div>
    </div>
  )
}
