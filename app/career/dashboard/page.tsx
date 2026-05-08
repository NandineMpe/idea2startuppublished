"use client"

import { motion } from "framer-motion"
import { Briefcase, ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

const plannedModules = [
  { title: "Job Tracker", description: "Track applications, interviews, and offers in one organized pipeline." },
  { title: "Resume Builder", description: "AI-powered resume tailoring for every role you apply to." },
  { title: "Network Map", description: "Visualize and nurture your professional connections strategically." },
  { title: "Skill Development", description: "Identify skill gaps and get personalized learning recommendations." },
  { title: "Interview Prep", description: "Practice with AI mock interviews tailored to your target roles." },
  { title: "Career Analytics", description: "Track your career trajectory, salary benchmarks, and market trends." },
]

export default function CareerDashboardPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-emerald-50 to-white p-6 dark:from-[#051912] dark:to-[#0a0a0a] lg:p-12"
    >
      <motion.div variants={item} className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-100 shadow-[0_0_0_8px_rgba(16,185,129,0.08),0_14px_32px_rgba(5,150,105,0.18)] dark:bg-emerald-500/10">
          <Briefcase className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-emerald-600 dark:text-emerald-400">
          Career OS
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
          Coming soon
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-8 text-slate-600 dark:text-slate-300">
          We are building your intelligent career co-pilot. Career OS will help you navigate
          job search, networking, and career growth with clarity.
        </p>
      </motion.div>

      <motion.div variants={item} className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plannedModules.map((mod) => (
          <div
            key={mod.title}
            className="rounded-2xl border border-emerald-200/60 bg-white/80 p-5 shadow-sm backdrop-blur transition-colors dark:border-emerald-500/10 dark:bg-white/[0.03]"
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">{mod.title}</p>
            </div>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{mod.description}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-white/[0.04] dark:text-emerald-300 dark:hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all modes
        </Link>
      </motion.div>
    </motion.div>
  )
}
