"use client"

import { motion } from "framer-motion"
import { Briefcase, Compass, Rocket, Sparkles } from "lucide-react"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

const sections = [
  {
    icon: Compass,
    title: "Ecosystem opportunities",
    body: "Grants, accelerators, partnerships, and events worth your time. We will wire this to your context and signals.",
  },
  {
    icon: Rocket,
    title: "Applications",
    body: "Deadlines and links for programs you care about. One place to track what you opened and what you shipped.",
  },
  {
    icon: Briefcase,
    title: "Jobs & roles",
    body: "High-signal roles (including non-obvious ones) that match your thesis and stage. Coming soon.",
  },
  {
    icon: Sparkles,
    title: "Everything else",
    body: "Hacks, intros, communities, and small bets that stack surface area. This is the luck engine.",
  },
] as const

export default function LuckmaxxingPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl mx-auto"
    >
      <motion.div variants={item} className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Surface area</p>
        <h1 className="text-2xl font-semibold text-foreground">Luckmaxxing</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Stack the odds: ecosystem openings, applications, jobs, and other moves that increase your luck. You will
          curate here; Juno will help fill it from your company profile and intelligence feed.
        </p>
      </motion.div>

      <motion.ul variants={item} className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-lg border border-border bg-card p-4 shadow-sm flex flex-col gap-2"
          >
            <div className="flex items-center gap-2 text-foreground">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-[13px] font-semibold">{title}</span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{body}</p>
          </li>
        ))}
      </motion.ul>

      <motion.div
        variants={item}
        className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center"
      >
        <p className="text-sm text-muted-foreground">
          This page is live. Next step: hook feeds, saved lists, and reminders so nothing good slips past.
        </p>
      </motion.div>
    </motion.div>
  )
}
