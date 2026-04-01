import Link from "next/link"
import localFont from "next/font/local"
import { ArrowRight, Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LandingThemeToggle } from "@/components/landing-theme-toggle"

const casualHuman = localFont({
  src: "./fonts/CasualHuman.otf",
  display: "swap",
})

const casualHumanBold = localFont({
  src: "./fonts/CasualHuman-Bold.otf",
  display: "swap",
})

const editorialHeading = {
  fontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
}

const valuePillars = [
  {
    title: "Keep the company context together",
    body:
      "Strategy, notes, assets, founder voice, and moving decisions stay in one place instead of being rebuilt from scratch every morning.",
  },
  {
    title: "Wake up to a daily intelligence brief",
    body:
      "Juno turns all that context into a daily read on what matters now, what changed overnight, and where focus should go next.",
  },
  {
    title: "Move the next workflow forward",
    body:
      "Outreach, research, and operating workflows stay close to the context that shaped them, so execution feels coherent.",
  },
]

const howItWorks = [
  {
    number: "01",
    title: "Bring the company into one workspace",
    body:
      "Capture the notes, decisions, documents, founder voice, and live operating context that usually live across too many tabs.",
  },
  {
    number: "02",
    title: "Let Juno shape that into daily intelligence",
    body:
      "Use briefs, summaries, and guided context to turn scattered information into a daily intelligence read you can actually think with.",
  },
  {
    number: "03",
    title: "Act from a calmer starting point",
    body:
      "Run the next motion from the same source of truth, whether that is planning, research, or founder-facing execution.",
  },
]

const commitments = [
  "Less rebuilding the company from scratch",
  "Less noise masquerading as productivity",
  "More continuity between thinking and doing",
  "More space for human judgment",
]

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

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef3f9] text-slate-950 transition-colors duration-700 dark:bg-[#061219] dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(238,243,249,0.96)_52%,rgba(232,239,248,1))]" />
        <div className="absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_50%_0%,rgba(196,220,247,0.6),transparent_58%)]" />
        <div className="absolute left-[-8rem] top-24 h-80 w-80 rounded-full bg-sky-100/70 blur-3xl" />
        <div className="absolute right-[-6rem] top-32 h-96 w-96 rounded-full bg-blue-50/80 blur-3xl" />
        <div className="absolute inset-x-0 top-[28rem] h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent" />
        <ResortDarkBackdrop />
      </div>

      <div className="relative z-10">
        <header className="px-6 pt-6 lg:px-10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-[1.7rem] border border-white/90 bg-white/65 p-2 shadow-[0_18px_50px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_rgba(2,8,14,0.4)]">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                aria-label="Home"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full"
              >
                <BlueDotMark className="h-5 w-5" />
              </Link>

              <nav className="hidden items-center gap-1 md:flex">
                <Link
                  href="#about"
                  className="rounded-full px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  About
                </Link>
                <Link
                  href="#how-it-works"
                  className="rounded-full px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  How it works
                </Link>
                <Link
                  href="#letter"
                  className="rounded-full px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  Letter
                </Link>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <LandingThemeToggle />
              <Button
                asChild
                className="rounded-full bg-slate-950 px-5 text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
              >
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          </div>
        </header>

        <main className="px-6 lg:px-10">
          <section className="mx-auto flex min-h-[78vh] max-w-6xl flex-col items-center justify-center pb-14 pt-20 text-center md:pt-24">
            <p className="text-sm uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/60">
              A calm operating system for founders
            </p>
            <div className="mt-6">
              <BlueDotMark className="h-16 w-16 md:h-20 md:w-20" />
            </div>

            <h1
              style={editorialHeading}
              className="mt-6 max-w-5xl text-5xl leading-[1.02] tracking-[-0.045em] text-slate-950 dark:text-white md:text-7xl"
            >
              Keep your company context in one place.
              <br className="hidden md:block" />
              Wake up every day to presidential-level intelligence.
            </h1>

            <p className="mt-8 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300 md:text-xl">
              Juno is a workspace for company context, daily intelligence, and founder execution.
              It keeps the company together, then turns that context into a daily brief on your
              business, your industry, and the next important move.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-14 rounded-full bg-slate-950 px-7 text-base text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)] hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
              >
                <Link href="/dashboard">
                  Enter Juno
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 rounded-full border-slate-300/80 bg-white/60 px-7 text-base text-slate-900 backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/10"
              >
                <Link href="#about">See what Juno actually does</Link>
              </Button>
            </div>
          </section>

          <section id="about" className="mx-auto max-w-6xl pb-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[2.2rem] border border-white/90 bg-white/65 p-7 shadow-[0_24px_70px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_80px_rgba(2,8,14,0.32)] md:p-8">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">
                  What Juno actually does
                </p>
                <h2
                  style={editorialHeading}
                  className="mt-4 max-w-3xl text-4xl leading-tight tracking-[-0.04em] text-slate-950 dark:text-white md:text-5xl"
                >
                  One place for context, one sharper starting point every day.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
                  The point is not to add more AI to your workflow. The point is to make the
                  company easier to hold, easier to brief, and easier to move forward without
                  losing the thread.
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {valuePillars.map((pillar) => (
                    <div
                      key={pillar.title}
                      className="rounded-[1.6rem] border border-slate-200/80 bg-[#f9fbfe]/90 p-5 shadow-[0_12px_32px_rgba(148,163,184,0.08)] transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_18px_40px_rgba(2,8,14,0.24)]"
                    >
                      <p className="text-base font-semibold leading-7 text-slate-900 dark:text-white">
                        {pillar.title}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                        {pillar.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="rounded-[2.2rem] border border-slate-200/80 bg-slate-950 p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] transition-colors duration-700 dark:border-white/10 dark:bg-[#081923]/85 dark:shadow-[0_28px_90px_rgba(2,8,14,0.4)]">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-300 dark:text-sky-100/60">Why it matters</p>
                <h3
                  style={editorialHeading}
                  className="mt-4 text-4xl leading-tight tracking-[-0.04em] text-white"
                >
                  Founders do too much context-switching.
                </h3>
                <p className="mt-5 text-sm leading-8 text-slate-300">
                  Juno is meant to feel like a well-prepared desk: the company is already here,
                  your morning intelligence is already shaped, and the next move begins from
                  continuity instead of reconstruction.
                </p>

                <div className="mt-8 space-y-3">
                  {commitments.map((commitment) => (
                    <div key={commitment} className="flex items-start gap-3">
                      <Check className="mt-1 h-4 w-4 text-sky-300" />
                      <p className="text-sm leading-7 text-slate-200">{commitment}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section id="how-it-works" className="mx-auto max-w-6xl pb-8 pt-8">
            <div className="rounded-[2.2rem] border border-white/90 bg-white/60 p-7 shadow-[0_24px_70px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_80px_rgba(2,8,14,0.32)] md:p-8">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">How it works</p>
                <h2
                  style={editorialHeading}
                  className="mt-4 text-4xl leading-tight tracking-[-0.04em] text-slate-950 dark:text-white md:text-5xl"
                >
                  Calm structure first. Motion second.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600 dark:text-slate-300">
                  Juno works best when it starts by holding the company properly, then turns that
                  into clarity, and only then helps you execute from it.
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {howItWorks.map((step) => (
                  <article
                    key={step.number}
                    className="rounded-[1.6rem] border border-slate-200/80 bg-[#fbfdff]/90 p-6 shadow-[0_12px_32px_rgba(148,163,184,0.08)] transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-[0_18px_40px_rgba(2,8,14,0.24)]"
                  >
                    <p className="text-sm uppercase tracking-[0.26em] text-slate-400 dark:text-sky-100/40">
                      {step.number}
                    </p>
                    <h3 className="mt-4 text-xl font-semibold leading-8 text-slate-900 dark:text-white">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {step.body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            id="letter"
            className="mx-auto grid max-w-6xl gap-6 pb-24 pt-8 lg:grid-cols-[1.05fr_0.95fr]"
          >
            <article className="rounded-[2.3rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(248,251,255,0.76))] p-8 shadow-[0_30px_90px_rgba(148,163,184,0.14)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,28,37,0.82),rgba(7,18,25,0.92))] dark:shadow-[0_32px_100px_rgba(2,8,14,0.45)] md:p-10">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">A letter from</p>
              <p className={`${casualHumanBold.className} mt-4 text-5xl leading-none text-slate-900 dark:text-white`}>
                Juno AI
              </p>

              <div className={`${casualHuman.className} mt-8 space-y-5 text-[1.05rem] leading-8 text-slate-700 dark:text-slate-200`}>
                <p>Dear founder,</p>
                <p>
                  You already carry too much of the company in your head: the strategy, the
                  half-finished notes, the product truth, the founder story, the priorities that
                  changed yesterday, and the things everyone keeps asking you to restate.
                </p>
                <p>
                  I am here to help hold that context with you. To keep the company coherent. To
                  turn scattered material into daily, presidential-level intelligence about your
                  business and industry. To make the next move feel steadier.
                </p>
                <p>
                  I am not here to replace your judgment. I am here to give it a calmer place to
                  work from.
                </p>
              </div>

              <div className="mt-10 border-t border-slate-200/80 pt-6 dark:border-white/10">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500 dark:text-sky-100/55">With you,</p>
                <p className={`${casualHumanBold.className} mt-3 text-4xl leading-none text-slate-900 dark:text-white`}>
                  Juno AI
                </p>
              </div>
            </article>

            <div className="space-y-6">
              <div className="rounded-[2rem] border border-white/90 bg-white/65 p-8 shadow-[0_24px_70px_rgba(148,163,184,0.12)] backdrop-blur-xl transition-colors duration-700 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_80px_rgba(2,8,14,0.32)]">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.28em] text-slate-500 dark:border-white/10 dark:bg-white/[0.05] dark:text-sky-100/55">
                  <Sparkles className="h-3.5 w-3.5" />
                  The feeling
                </div>
                <h3
                  style={editorialHeading}
                  className="mt-5 text-4xl leading-tight tracking-[-0.04em] text-slate-950 dark:text-white"
                >
                  Not another dashboard.
                  <br />
                  More like a resort after dark.
                </h3>
                <p className="mt-5 text-sm leading-8 text-slate-600 dark:text-slate-300">
                  The experience should feel composed, legible, and quiet enough for real thinking.
                  In dark mode, the page settles into a softer night palette with slow cloud-shadow
                  movement, like a calm resort terrace after sunset.
                </p>
              </div>

              <div className="rounded-[2rem] border border-white/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(233,241,250,0.78))] p-8 shadow-[0_24px_70px_rgba(148,163,184,0.12)] transition-colors duration-700 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(12,32,42,0.9),rgba(7,19,27,0.9))] dark:shadow-[0_24px_80px_rgba(2,8,14,0.36)]">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-sky-100/55">Ready when you are</p>
                <h3 className="mt-4 text-2xl font-semibold leading-9 tracking-[-0.04em] text-slate-950 dark:text-white">
                  Bring the company in.
                  <br />
                  Let Juno brief you every morning.
                </h3>
                <p className="mt-4 text-sm leading-8 text-slate-600 dark:text-slate-300">
                  Start with the workspace, pull in your context, and wake up every day to a
                  sharper intelligence brief.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="mt-6 h-14 rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800 dark:bg-sky-100 dark:text-slate-950 dark:hover:bg-white"
                >
                  <Link href="/dashboard">Open dashboard</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
