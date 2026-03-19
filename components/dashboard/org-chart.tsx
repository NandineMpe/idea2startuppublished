"use client"

import { motion } from "framer-motion"
import {
  UserCircle,
  Briefcase,
  FlaskConical,
  Megaphone,
  Wallet,
  Cog,
  Crown,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/paperclip"
import { AgentStatusDot } from "./agent-status-dot"

const roleIcons: Record<string, React.ElementType> = {
  cbs: Briefcase,
  cro: FlaskConical,
  cmo: Megaphone,
  cfo: Wallet,
  coo: Cog,
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

interface OrgChartProps {
  compact?: boolean
}

export function OrgChart({ compact = false }: OrgChartProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center gap-6"
    >
      {/* CEO / Board (You) */}
      <motion.div variants={item} className="flex flex-col items-center">
        <div className={cn(
          "glass-card border border-primary/30 rounded-xl flex items-center gap-3",
          compact ? "px-4 py-2.5" : "px-6 py-4"
        )}>
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className={cn("font-bold text-primary", compact ? "text-sm" : "text-base")}>You</p>
            <p className="text-xs text-white/50">CEO / Board of Directors</p>
          </div>
        </div>
      </motion.div>

      {/* Connecting line */}
      <motion.div variants={item} className="w-px h-6 bg-primary/20" />

      {/* Horizontal connector */}
      <motion.div variants={item} className="relative w-full max-w-4xl">
        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-white/10" />
        <div className="flex justify-between px-[10%]">
          {ROLE_ORDER.map((slug) => (
            <div key={slug} className="w-px h-4 bg-white/10" />
          ))}
        </div>
      </motion.div>

      {/* Executive Cards */}
      <motion.div variants={item} className={cn(
        "grid gap-3 w-full",
        compact ? "grid-cols-5" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      )}>
        {ROLE_ORDER.map((slug) => {
          const config = ROLE_CONFIGS[slug]
          const Icon = roleIcons[slug] || UserCircle

          return (
            <Link key={slug} href={`/dashboard/team/${slug}`}>
              <motion.div
                whileHover={{ y: -2, scale: 1.02 }}
                className={cn(
                  "glass-card border border-white/5 hover:border-primary/20 rounded-xl transition-all duration-300 cursor-pointer group",
                  compact ? "p-3" : "p-4"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("rounded-lg flex items-center justify-center", config.bgColor, compact ? "w-7 h-7" : "w-9 h-9")}>
                    <Icon className={cn(config.color, compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                  </div>
                  <AgentStatusDot status="active" size="sm" />
                </div>
                <p className={cn(
                  "font-semibold text-white group-hover:text-primary transition-colors",
                  compact ? "text-xs" : "text-sm"
                )}>
                  {config.shortTitle}
                </p>
                <p className={cn("text-white/40 mt-0.5", compact ? "text-[10px]" : "text-xs")}>
                  {config.title}
                </p>
                {!compact && (
                  <p className="text-xs text-white/30 mt-2">
                    ${config.budgetMonthlyCents / 100}/mo
                  </p>
                )}
              </motion.div>
            </Link>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
