"use client"

import { motion } from "framer-motion"
import {
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
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
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
      className="flex flex-col items-center gap-4"
    >
      <motion.div variants={item} className="flex flex-col items-center">
        <div className={cn(
          "rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-3",
          compact ? "px-3 py-2" : "px-5 py-3"
        )}>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className={cn("font-semibold text-primary", compact ? "text-[13px]" : "text-sm")}>You</p>
            <p className="text-[11px] text-muted-foreground">CEO / Board</p>
          </div>
        </div>
      </motion.div>

      <motion.div variants={item} className="w-px h-5 bg-border" />

      <motion.div variants={item} className="relative w-full max-w-3xl">
        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-border" />
        <div className="flex justify-between px-[10%]">
          {ROLE_ORDER.map((slug) => (
            <div key={slug} className="w-px h-3 bg-border" />
          ))}
        </div>
      </motion.div>

      <motion.div variants={item} className={cn(
        "grid gap-2.5 w-full",
        compact ? "grid-cols-5" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      )}>
        {ROLE_ORDER.map((slug) => {
          const config = ROLE_CONFIGS[slug]
          const Icon = roleIcons[slug] || Briefcase

          return (
            <Link key={slug} href={`/dashboard/team/${slug}`}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors duration-200 cursor-pointer group",
                  compact ? "p-2.5" : "p-3.5"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("rounded-md flex items-center justify-center", config.bgColor, compact ? "w-6 h-6" : "w-8 h-8")}>
                    <Icon className={cn(config.color, compact ? "h-3 w-3" : "h-4 w-4")} />
                  </div>
                  <AgentStatusDot status="active" size="sm" />
                </div>
                <p className={cn(
                  "font-semibold text-foreground group-hover:text-primary transition-colors",
                  compact ? "text-[11px]" : "text-[13px]"
                )}>
                  {config.shortTitle}
                </p>
                <p className={cn("text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-[11px]")}>
                  {config.title}
                </p>
                {!compact && (
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5">
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
