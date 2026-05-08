"use client"

import { motion } from "framer-motion"
import {
  Calendar,
  TrendingUp,
  Users,
  Eye,
  Heart,
  MessageSquare,
  ArrowUpRight,
  Play,
  FileText,
  Image,
  Mic,
  Video,
  Clock,
  Sparkles,
  BarChart3,
} from "lucide-react"
import Link from "next/link"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

const quickActions = [
  { label: "New post", icon: FileText, color: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
  { label: "Upload video", icon: Video, color: "text-pink-600 dark:text-pink-400 bg-pink-500/10" },
  { label: "Record audio", icon: Mic, color: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  { label: "Design asset", icon: Image, color: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
]

const upcomingContent = [
  { title: "Weekly newsletter draft", platform: "Email", due: "Today, 5:00 PM", status: "In progress" },
  { title: "Product review video", platform: "YouTube", due: "Tomorrow, 10:00 AM", status: "Scripting" },
  { title: "Behind-the-scenes reel", platform: "Instagram", due: "Wed, 2:00 PM", status: "Scheduled" },
  { title: "Thread on AI creativity tools", platform: "X / Twitter", due: "Thu, 9:00 AM", status: "Draft" },
  { title: "Podcast episode #24", platform: "Spotify", due: "Fri, 12:00 PM", status: "Recording" },
]

const topPerformingContent = [
  { title: "How I built a 100K audience in 6 months", views: "42.3K", engagement: "8.2%", platform: "YouTube" },
  { title: "The creator economy is broken — here's why", views: "28.1K", engagement: "12.4%", platform: "X / Twitter" },
  { title: "5 tools every creator needs in 2025", views: "19.7K", engagement: "6.8%", platform: "Blog" },
]

const platformStats = [
  { name: "YouTube", followers: "124K", growth: "+2.3%", color: "text-red-600 dark:text-red-400" },
  { name: "Instagram", followers: "89K", growth: "+1.8%", color: "text-pink-600 dark:text-pink-400" },
  { name: "X / Twitter", followers: "67K", growth: "+4.1%", color: "text-sky-600 dark:text-sky-400" },
  { name: "TikTok", followers: "203K", growth: "+6.7%", color: "text-foreground" },
  { name: "Newsletter", followers: "31K", growth: "+3.2%", color: "text-amber-600 dark:text-amber-400" },
]

const brandDeals = [
  { brand: "TechFlow", value: "$4,500", status: "Negotiating", deadline: "May 15" },
  { brand: "CreatorKit Pro", value: "$2,800", status: "In review", deadline: "May 20" },
  { brand: "Notion", value: "$6,000", status: "Confirmed", deadline: "Jun 1" },
]

export default function CreatorDashboardPage() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={item} className="flex flex-col gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Creator overview
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Content Hub</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Your creative command center. Plan content, track performance, and grow your audience across every platform.
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${action.color}`}>
              <action.icon className="h-4 w-4" />
            </div>
            <span className="text-[13px] font-medium text-foreground">{action.label}</span>
          </button>
        ))}
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Main column */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 flex flex-col gap-6">
          {/* Stats Overview */}
          <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Eye className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Total views</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">1.2M</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +12.4% vs last month
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Heart className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Engagement</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">7.8%</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +0.6% vs last month
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Followers</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">514K</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +8.3K this month
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Comments</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">3.4K</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +18% vs last month
              </p>
            </div>
          </motion.div>

          {/* Upcoming Content */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-[14px] font-semibold text-foreground">Upcoming content</h2>
              </div>
              <Link
                href="/creator/dashboard/calendar"
                className="text-[12px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1"
              >
                View calendar <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {upcomingContent.map((content) => (
                <div key={content.title} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                    <Play className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{content.title}</p>
                    <p className="text-[11px] text-muted-foreground">{content.platform}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {content.due}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      content.status === "Scheduled"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : content.status === "In progress"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-violet-500/10 text-violet-700 dark:text-violet-400"
                    }`}>
                      {content.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Top Performing Content */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-[14px] font-semibold text-foreground">Top performing content</h2>
              </div>
              <Link
                href="/creator/dashboard/analytics"
                className="text-[12px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1"
              >
                View analytics <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {topPerformingContent.map((content) => (
                <div key={content.title} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{content.title}</p>
                    <p className="text-[11px] text-muted-foreground">{content.platform}</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-4">
                    <div>
                      <p className="text-[12px] font-medium text-foreground tabular-nums">{content.views}</p>
                      <p className="text-[10px] text-muted-foreground">views</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">{content.engagement}</p>
                      <p className="text-[10px] text-muted-foreground">engagement</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Brand Deals */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <h2 className="text-[14px] font-semibold text-foreground">Active brand deals</h2>
              </div>
              <Link
                href="/creator/dashboard/collaborations"
                className="text-[12px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 flex items-center gap-1"
              >
                All collaborations <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {brandDeals.map((deal) => (
                <div key={deal.brand} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-[12px] font-bold text-violet-600 dark:text-violet-400">
                    {deal.brand[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{deal.brand}</p>
                    <p className="text-[11px] text-muted-foreground">Due {deal.deadline}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-semibold text-foreground">{deal.value}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      deal.status === "Confirmed"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : deal.status === "Negotiating"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                    }`}>
                      {deal.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right sidebar — Platform Stats */}
        <aside className="order-1 lg:order-2 w-full lg:w-[340px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start flex flex-col gap-6">
          <motion.div variants={item} className="rounded-lg border-2 border-violet-500/25 bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-violet-500/5">
              <h2 className="text-base font-semibold text-foreground">Platform growth</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">Followers across channels</p>
            </div>
            <div className="p-4 space-y-3">
              {platformStats.map((platform) => (
                <div key={platform.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[13px] font-medium ${platform.color}`}>{platform.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold text-foreground tabular-nums">{platform.followers}</span>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums w-12 text-right">{platform.growth}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">AI content ideas</h3>
            <div className="space-y-2.5">
              <div className="rounded-md border border-dashed border-violet-500/30 bg-violet-500/5 p-3">
                <p className="text-[12px] text-foreground/90 leading-relaxed">
                  <span className="font-medium text-violet-700 dark:text-violet-400">Trending topic:</span> AI-powered video editing tools are seeing 340% more search volume this week.
                </p>
              </div>
              <div className="rounded-md border border-dashed border-violet-500/30 bg-violet-500/5 p-3">
                <p className="text-[12px] text-foreground/90 leading-relaxed">
                  <span className="font-medium text-violet-700 dark:text-violet-400">Content gap:</span> Your audience engages 2x more with tutorial-style content. Consider a how-to series.
                </p>
              </div>
              <div className="rounded-md border border-dashed border-violet-500/30 bg-violet-500/5 p-3">
                <p className="text-[12px] text-foreground/90 leading-relaxed">
                  <span className="font-medium text-violet-700 dark:text-violet-400">Best time to post:</span> Your followers are most active Tue-Thu between 10 AM-1 PM EST.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">Brand Voice Studio</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Define your tone, style, and messaging across all platforms with AI assistance.
                </p>
                <Link
                  href="/creator/dashboard/brand-voice"
                  className="text-[12px] text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 mt-2 inline-flex items-center gap-1"
                >
                  Open studio <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        </aside>
      </div>
    </motion.div>
  )
}
