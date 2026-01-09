"use client"

import { motion } from "framer-motion"
import {
  BarChart3,
  Calendar,
  CheckCircle,
  FileText,
  LineChart,
  PieChart,
  Rocket,
  Users,
  DollarSign,
  TrendingUp,
  Briefcase,
  Award,
  ArrowUpRight,
  Clock,
  Zap,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BentoGrid, BentoCard } from "@/components/dashboard/bento-grid"
import { MetricCard } from "@/components/dashboard/metric-card"

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
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-8 p-8 max-w-7xl mx-auto"
    >
      <motion.div variants={item} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-medium tracking-wider uppercase text-xs">
            <Zap className="h-3 w-3 fill-primary" />
            Founder Command Center
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-primary italic">Extraordinaire</span>
          </h1>
          <p className="text-white/60 max-w-xl">
            The future doesn't build itself. You're 65% of the way to your next milestone.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 rounded-full">
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-black font-bold rounded-full shadow-[0_0_15px_rgba(39,174,96,0.3)]">
            <Rocket className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-white/5 border border-white/10 rounded-full p-1 self-start">
          <TabsTrigger
            value="overview"
            className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-black transition-all duration-300"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="intelligence"
            className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-black transition-all duration-300"
          >
            Intelligence
          </TabsTrigger>
          <TabsTrigger
            value="roadmap"
            className="rounded-full px-8 data-[state=active]:bg-primary data-[state=active]:text-black transition-all duration-300"
          >
            Roadmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 outline-none">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Active Projects", value: "2", icon: Rocket, trend: "+1 this month" },
              { title: "Pending Tasks", value: "3", icon: CheckCircle, trend: "2 high priority" },
              { title: "Market Insights", value: "12", icon: Target, trend: "New data available" },
              { title: "Network Growth", value: "+24%", icon: Users, trend: "4 new leads" },
            ].map((stat, i) => (
              <motion.div key={i} variants={item}>
                <Card className="glass-card border-white/5 hover:border-primary/20 transition-all duration-500 group overflow-hidden relative">
                  <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                    <stat.icon className="h-24 w-24 text-primary" />
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-white/60 text-sm font-medium flex items-center gap-2 uppercase tracking-widest">
                      <stat.icon className="h-4 w-4 text-primary" />
                      {stat.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                    <p className="text-xs text-primary flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {stat.trend}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Project Progress */}
            <motion.div variants={item} className="lg:col-span-2">
              <Card className="glass-card border-white/5 h-full">
                <CardHeader className="flex flex-row items-center justify-between pb-8">
                  <div>
                    <CardTitle className="text-xl text-white">Active Trajectory</CardTitle>
                    <CardDescription className="text-white/40">Real-time status of your ventures</CardDescription>
                  </div>
                  <Button variant="ghost" className="text-primary hover:text-primary/80 hover:bg-primary/5">
                    Manage All <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-8">
                  {[
                    { name: "Healthcare AI Assistant", stage: "Validation", progress: 65, color: "bg-primary" },
                    { name: "Sustainable Supply Chain", stage: "Ideation", progress: 32, color: "bg-cyan-400" },
                  ].map((project, i) => (
                    <div key={i} className="space-y-3 group">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-white group-hover:text-primary transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/5 uppercase tracking-tighter">
                              {project.stage}
                            </span>
                            <span className="text-[10px] text-white/20">• Updated 2d ago</span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-white">{project.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${project.progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                          className={`h-full ${project.color} shadow-[0_0_10px_rgba(255,255,255,0.1)]`}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Task Radar */}
            <motion.div variants={item}>
              <Card className="glass-card border-white/5 h-full">
                <CardHeader className="pb-6">
                  <CardTitle className="text-xl text-white">Critical Path</CardTitle>
                  <CardDescription className="text-white/40">Immediate action required</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { task: "Refine Market Research", due: "Tomorrow", priority: "High", icon: Target },
                    { task: "Schedule Mentor Session", due: "Today", priority: "High", icon: Users },
                    { task: "Update Pitch Deck", due: "Friday", priority: "Medium", icon: FileText },
                  ].map((task, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all cursor-pointer group">
                      <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center text-primary border border-primary/20 group-hover:bg-primary group-hover:text-black transition-all">
                        <task.icon size={18} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white group-hover:text-primary transition-colors">{task.task}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-white/20" />
                          <span className="text-[10px] text-white/40">{task.due}</span>
                          <span className={`text-[10px] uppercase font-bold tracking-widest ${task.priority === 'High' ? 'text-red-400' : 'text-primary'}`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="pt-2">
                  <Button variant="ghost" className="w-full text-white/40 hover:text-white text-xs">
                    View Full Roadmap
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </div>

          {/* Performance Pulse */}
          <motion.div variants={item}>
            <Card className="glass-card border-white/5 overflow-hidden">
              <CardHeader className="pb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl text-white">Venture Vitality</CardTitle>
                    <CardDescription className="text-white/40">Aggregated performance across all modules</CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                      <span className="text-xs text-white/60">Live Analytics</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[
                    { label: "Growth Potential", value: "84%", trend: "+2.4%", icon: TrendingUp },
                    { label: "Community Engagement", value: "1.2k", trend: "+120", icon: Users },
                    { label: "Resource Efficiency", value: "92%", trend: "+5.1%", icon: BarChart3 },
                    { label: "Founder Readiness", value: "Master", trend: "Level up!", icon: Award },
                  ].map((metric, i) => (
                    <div key={i} className="space-y-2 relative group">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-white/40 uppercase tracking-widest">{metric.label}</p>
                        <metric.icon className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-2xl font-bold text-white">{metric.value}</span>
                        <span className="text-[10px] text-primary mb-1">{metric.trend}</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                        <motion.div
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 1.5, delay: 1 + i * 0.1 }}
                          className="h-full bg-gradient-to-r from-primary/20 to-primary origin-left"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="intelligence" className="h-[400px] flex items-center justify-center border border-white/5 rounded-3xl bg-white/[0.02]">
          <div className="text-center space-y-4 max-w-sm">
            <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tighter">AI Core Loading...</h3>
            <p className="text-white/40 text-sm">
              We're calibrating Juno for your specific project vertical. Your intelligence dashboard will be ready shortly.
            </p>
            <Button variant="outline" className="border-primary/20 text-primary hover:bg-primary/10 rounded-full mt-4">
              Access Beta AI Tools
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="roadmap" className="h-[400px] flex items-center justify-center border border-white/5 rounded-3xl bg-white/[0.02]">
          <div className="text-center space-y-4 max-w-sm">
            <div className="h-16 w-16 bg-cyan-400/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Target className="h-8 w-8 text-cyan-400 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Roadmap Architect</h3>
            <p className="text-white/40 text-sm">
              Building your multi-year trajectory based on current market signals. Stand by for launch coordinates.
            </p>
            <Button variant="outline" className="border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/10 rounded-full mt-4">
              Define Milestones
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
