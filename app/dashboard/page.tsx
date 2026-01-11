"use client"

import { motion } from "framer-motion"
import {
  Lightbulb,
  Rocket,
  TrendingUp,
  PresentationIcon,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export default function DashboardPage() {
  const tools = [
    {
      title: "Business Idea Analysis",
      description: "Validate your startup idea with AI-driven market intelligence.",
      href: "/dashboard/idea/analyser",
      icon: Lightbulb,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
    },
    {
      title: "Go-To-Market Strategy",
      description: "Generate a comprehensive plan to launch and scale your product.",
      href: "/dashboard/market/strategy",
      icon: Rocket,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      title: "Pitch Vault",
      description: "Craft compelling pitches for investors, customers, and partners.",
      href: "/dashboard/pitch",
      icon: PresentationIcon,
      color: "text-pink-400",
      bg: "bg-pink-400/10",
    },
    {
      title: "Founder's Journey",
      description: "Navigate the startup lifecycle with expert guidance and resources.",
      href: "/dashboard/knowledge/founders-journey",
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ]

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-8 p-8 max-w-7xl mx-auto"
    >
      <motion.div variants={item} className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary font-medium tracking-wider uppercase text-xs">
          <Zap className="h-3 w-3 fill-primary" />
          Founder Command Center
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Welcome, <span className="text-primary italic">Founder</span>
        </h1>
        <p className="text-white/60 max-w-xl">
          Ready to build the future? Select a tool to get started.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool, i) => (
          <motion.div key={i} variants={item}>
            <Link href={tool.href}>
              <Card className="glass-card border-white/5 hover:border-primary/20 transition-all duration-300 h-full group hover:bg-white/5 cursor-pointer">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${tool.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <tool.icon className={`h-6 w-6 ${tool.color}`} />
                  </div>
                  <CardTitle className="text-xl text-white group-hover:text-primary transition-colors">
                    {tool.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-white/60">
                    {tool.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
