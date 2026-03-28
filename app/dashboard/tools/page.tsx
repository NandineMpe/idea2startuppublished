"use client"

import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { ROLE_CONFIGS, ROLE_ORDER } from "@/lib/agent-roles"
import { useState, useMemo } from "react"

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

export default function ToolsPage() {
  const [query, setQuery] = useState("")

  const filtered = useMemo(
    () =>
      ROLE_ORDER.map((slug) => {
        const config = ROLE_CONFIGS[slug]
        const tools = config.responsibilities.filter(
          (r) =>
            query === "" ||
            r.title.toLowerCase().includes(query.toLowerCase()) ||
            r.description.toLowerCase().includes(query.toLowerCase()),
        )
        return { config, tools }
      }).filter(({ tools }) => tools.length > 0),
    [query],
  )

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-5xl mx-auto"
    >
      <motion.div variants={item} className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Agent workflows</p>
        <h1 className="text-2xl font-semibold text-foreground">Tools &amp; workflows</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Each link runs a focused task through the right executive agent — you drive the run and own the outcome.
          For recurring jobs and delegation, use the{" "}
          <Link href="/dashboard/command" className="text-primary hover:underline">
            Command Center
          </Link>{" "}
          and feed pipelines.
        </p>
      </motion.div>

      <motion.div variants={item}>
        <Input
          placeholder="Search tools..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs h-9 text-[13px] bg-background"
        />
      </motion.div>

      {filtered.map(({ config, tools }) => (
        <motion.div key={config.slug} variants={item}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className={`text-[11px] font-semibold uppercase tracking-widest ${config.color}`}>
              {config.shortTitle}
            </span>
            <span className="text-[13px] font-medium text-foreground">{config.title}</span>
            <div className={`h-px flex-1 ${config.bgColor} opacity-60`} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tools.map((tool, i) => (
              <Link key={i} href={tool.href}>
                <div className="rounded-lg border border-border bg-card hover:bg-accent/40 transition-all duration-150 p-4 h-full group cursor-pointer">
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[13px] font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                      {tool.title}
                    </p>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-all shrink-0 ml-2 mt-0.5" />
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{tool.description}</p>
                  <p className={`text-[11px] mt-2 font-medium ${config.color} opacity-70`}>
                    {config.shortTitle} · run when you need it
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      ))}

      {filtered.length === 0 && (
        <motion.div variants={item} className="text-center py-16 text-muted-foreground text-[13px]">
          No tools match &ldquo;{query}&rdquo;
        </motion.div>
      )}
    </motion.div>
  )
}

