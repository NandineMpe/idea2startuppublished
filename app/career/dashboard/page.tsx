"use client"

import { motion } from "framer-motion"
import {
  Briefcase,
  TrendingUp,
  Target,
  FileText,
  Network,
  GraduationCap,
  MessageCircle,
  ArrowUpRight,
  Clock,
  Send,
  Star,
  Award,
  Building2,
  MapPin,
  DollarSign,
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

const pipelineStages = [
  { label: "Saved", count: 12, color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  { label: "Applied", count: 8, color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  { label: "Screening", count: 3, color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  { label: "Interview", count: 2, color: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  { label: "Offer", count: 1, color: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
]

const activeApplications = [
  { company: "Stripe", role: "Senior Product Manager", location: "Remote", salary: "$180-220K", stage: "Interview", daysAgo: 2, logo: "S" },
  { company: "Figma", role: "Design Lead", location: "San Francisco, CA", salary: "$190-240K", stage: "Screening", daysAgo: 5, logo: "F" },
  { company: "Notion", role: "Staff Engineer", location: "New York, NY", salary: "$200-260K", stage: "Applied", daysAgo: 3, logo: "N" },
  { company: "Linear", role: "Product Designer", location: "Remote", salary: "$160-200K", stage: "Applied", daysAgo: 7, logo: "L" },
  { company: "Vercel", role: "Engineering Manager", location: "Remote", salary: "$210-270K", stage: "Offer", daysAgo: 1, logo: "V" },
]

const upcomingInterviews = [
  { company: "Stripe", round: "System Design (Round 3)", time: "Today, 2:00 PM", type: "Technical" },
  { company: "Figma", round: "Portfolio Review", time: "Tomorrow, 11:00 AM", type: "Design" },
  { company: "Stripe", round: "Hiring Manager (Final)", time: "Thu, 3:00 PM", type: "Behavioral" },
]

const skillProgress = [
  { skill: "System Design", level: 82, category: "Technical" },
  { skill: "Product Strategy", level: 75, category: "Product" },
  { skill: "Leadership", level: 68, category: "Soft Skills" },
  { skill: "SQL & Data Analysis", level: 90, category: "Technical" },
  { skill: "Stakeholder Management", level: 71, category: "Soft Skills" },
]

const networkActivity = [
  { name: "Sarah Chen", role: "VP Engineering at Stripe", action: "Accepted your connection", time: "2h ago" },
  { name: "Mike Rodriguez", role: "Recruiter at Figma", action: "Viewed your profile", time: "5h ago" },
  { name: "Emily Park", role: "PM Lead at Notion", action: "Endorsed your skills", time: "1d ago" },
  { name: "David Kim", role: "CTO at Linear", action: "Shared a job posting", time: "2d ago" },
]

const marketInsights = [
  { title: "Product Manager", demand: "High", avgSalary: "$165K", growth: "+12%" },
  { title: "Staff Engineer", demand: "Very High", avgSalary: "$220K", growth: "+18%" },
  { title: "Design Lead", demand: "Medium", avgSalary: "$175K", growth: "+8%" },
]

export default function CareerDashboardPage() {
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
          Career overview
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Career Hub</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Your intelligent career co-pilot. Track applications, prepare for interviews, and navigate your career growth with clarity.
        </p>
      </motion.div>

      {/* Application Pipeline */}
      <motion.div variants={item} className="grid grid-cols-5 gap-3">
        {pipelineStages.map((stage) => (
          <div key={stage.label} className={`rounded-lg border border-border bg-card p-4 text-center`}>
            <p className="text-2xl font-semibold text-foreground">{stage.count}</p>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block ${stage.color}`}>
              {stage.label}
            </span>
          </div>
        ))}
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Main column */}
        <div className="order-2 lg:order-1 flex-1 min-w-0 flex flex-col gap-6">
          {/* Stats Overview */}
          <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Send className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Applied</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">26</p>
              <p className="text-[11px] text-muted-foreground mt-1">this month</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MessageCircle className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Interviews</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">5</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> 19% response rate
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Network className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Network</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">342</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> +12 this week
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Star className="h-3.5 w-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">Profile score</span>
              </div>
              <p className="text-2xl font-semibold text-foreground">87</p>
              <p className="text-[11px] text-muted-foreground mt-1">/100</p>
            </div>
          </motion.div>

          {/* Active Applications */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-[14px] font-semibold text-foreground">Active applications</h2>
              </div>
              <Link
                href="/career/dashboard/jobs"
                className="text-[12px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {activeApplications.map((app) => (
                <div key={`${app.company}-${app.role}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-[13px] font-bold text-emerald-600 dark:text-emerald-400">
                    {app.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{app.role}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {app.company}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {app.location}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] font-medium text-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> {app.salary}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      app.stage === "Offer"
                        ? "bg-violet-500/10 text-violet-700 dark:text-violet-400"
                        : app.stage === "Interview"
                          ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                          : app.stage === "Screening"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }`}>
                      {app.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Upcoming Interviews */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-[14px] font-semibold text-foreground">Upcoming interviews</h2>
              </div>
              <Link
                href="/career/dashboard/interviews"
                className="text-[12px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                Prep center <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {upcomingInterviews.map((interview) => (
                <div key={`${interview.company}-${interview.round}`} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    interview.type === "Technical"
                      ? "bg-sky-500/10"
                      : interview.type === "Design"
                        ? "bg-violet-500/10"
                        : "bg-amber-500/10"
                  }`}>
                    {interview.type === "Technical" ? (
                      <BarChart3 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    ) : interview.type === "Design" ? (
                      <FileText className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{interview.round}</p>
                    <p className="text-[11px] text-muted-foreground">{interview.company}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {interview.time}
                    </p>
                    <span className="text-[10px] font-medium text-muted-foreground">{interview.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Skill Development */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-[14px] font-semibold text-foreground">Skill development</h2>
              </div>
              <Link
                href="/career/dashboard/skills"
                className="text-[12px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1"
              >
                All skills <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-5 space-y-4">
              {skillProgress.map((skill) => (
                <div key={skill.skill}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">{skill.skill}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{skill.category}</span>
                    </div>
                    <span className="text-[12px] font-medium text-foreground tabular-nums">{skill.level}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${skill.level}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right sidebar */}
        <aside className="order-1 lg:order-2 w-full lg:w-[340px] lg:shrink-0 lg:sticky lg:top-20 lg:self-start flex flex-col gap-6">
          {/* Network Activity */}
          <motion.div variants={item} className="rounded-lg border-2 border-emerald-500/25 bg-card shadow-sm">
            <div className="px-4 py-3 border-b border-border bg-emerald-500/5">
              <h2 className="text-base font-semibold text-foreground">Network activity</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">Recent connections</p>
            </div>
            <div className="p-4 space-y-3">
              {networkActivity.map((activity) => (
                <div key={activity.name} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {activity.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-foreground">{activity.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{activity.role}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">{activity.action}</p>
                    <p className="text-[10px] text-muted-foreground/70">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Market Insights */}
          <motion.div variants={item} className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">Market insights</h3>
            <div className="space-y-3">
              {marketInsights.map((role) => (
                <div key={role.title} className="rounded-md border border-dashed border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[12px] font-medium text-foreground">{role.title}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-muted-foreground">Demand: <span className="font-medium text-foreground/90">{role.demand}</span></span>
                    <span className="text-[11px] text-muted-foreground">Avg: <span className="font-medium text-foreground/90">{role.avgSalary}</span></span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{role.growth}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Resume & Interview Quick Actions */}
          <motion.div variants={item} className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">AI Resume Tailor</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Optimize your resume for each application with AI-powered suggestions and keyword matching.
                </p>
                <Link
                  href="/career/dashboard/resume"
                  className="text-[12px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mt-2 inline-flex items-center gap-1"
                >
                  Open builder <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </motion.div>

          <motion.div variants={item} className="rounded-lg border border-dashed border-border bg-muted/20 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">Interview Coach</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Practice with AI mock interviews tailored to your upcoming rounds and target companies.
                </p>
                <Link
                  href="/career/dashboard/interviews"
                  className="text-[12px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mt-2 inline-flex items-center gap-1"
                >
                  Start practicing <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        </aside>
      </div>
    </motion.div>
  )
}
