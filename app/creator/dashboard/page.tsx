"use client"

import { motion } from "framer-motion"
import { Palette, ArrowLeft, Sparkles } from "lucide-react"
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
  { title: "Content Calendar", description: "Plan, schedule, and publish across all your platforms from one place." },
  { title: "Audience Insights", description: "Understand who follows you, what resonates, and where to grow next." },
  { title: "Brand Voice Studio", description: "Define and refine your unique voice with AI-powered writing assistance." },
  { title: "Collaboration Hub", description: "Manage brand deals, partnerships, and creator collaborations." },
  { title: "Revenue Dashboard", description: "Track monetization across sponsorships, products, and subscriptions." },
  { title: "Content Analytics", description: "Deep performance metrics across every channel and format." },
]

export default function CreatorDashboardPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-violet-50 to-white p-6 dark:from-[#0f0519] dark:to-[#0a0a0a] lg:p-12"
    >
      <motion.div variants={item} className="text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-100 shadow-[0_0_0_8px_rgba(139,92,246,0.08),0_14px_32px_rgba(109,40,217,0.18)] dark:bg-violet-500/10">
          <Palette className="h-9 w-9 text-violet-600 dark:text-violet-400" />
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-violet-600 dark:text-violet-400">
          Creator OS
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl">
          Coming soon
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-8 text-slate-600 dark:text-slate-300">
          We are building your creative command center. Creator OS will be your single
          workspace for content, audience, and creative workflows.
        </p>
      </motion.div>

      <motion.div variants={item} className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plannedModules.map((mod) => (
          <div
            key={mod.title}
            className="rounded-2xl border border-violet-200/60 bg-white/80 p-5 shadow-sm backdrop-blur transition-colors dark:border-violet-500/10 dark:bg-white/[0.03]"
          >
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500 dark:text-violet-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-white">{mod.title}</p>
            </div>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{mod.description}</p>
          </div>
        ))}
      </motion.div>

      <motion.div variants={item}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-6 py-3 text-sm font-medium text-violet-700 shadow-sm transition-colors hover:bg-violet-50 dark:border-violet-500/20 dark:bg-white/[0.04] dark:text-violet-300 dark:hover:bg-white/[0.08]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all modes
        </Link>
      </motion.div>
    </motion.div>
  )
}
