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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BentoCard } from "@/components/dashboard/bento-grid"
import { MetricCard } from "@/components/dashboard/metric-card"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, <span className="text-primary">Founder</span>
        </h1>
        <p className="text-white/60">
          Track your progress, manage tasks, and access resources to help grow your startup.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-black border border-primary/20 rounded-full p-1">
          <TabsTrigger
            value="overview"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-white"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="snapshot"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-white"
          >
            Snapshot
          </TabsTrigger>
          <TabsTrigger
            value="projects"
            className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-white"
          >
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary animate-pulse-green" />
                  Active Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">2</div>
                <p className="text-sm text-white/60 mt-1">Startup projects in progress</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary animate-pulse-green" />
                  Pending Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">3</div>
                <p className="text-sm text-white/60 mt-1">Tasks awaiting completion</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary animate-pulse-green" />
                  Upcoming Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">2</div>
                <p className="text-sm text-white/60 mt-1">Events scheduled this week</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary animate-pulse-green" />
                  Resources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">3</div>
                <p className="text-sm text-white/60 mt-1">Available startup resources</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="glass-card border-primary/10 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white">Project Progress</CardTitle>
                <CardDescription className="text-white/60">Track your startup projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">Healthcare Assistant</h3>
                      <p className="text-sm text-white/60">Stage: Validation</p>
                    </div>
                    <span className="text-sm text-white/60">Updated 2 days ago</span>
                  </div>
                  <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "65%" }}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Progress</span>
                    <span className="text-sm font-medium text-primary">65%</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-white">Sustainable Supply Chain Platform</h3>
                      <p className="text-sm text-white/60">Stage: Ideation</p>
                    </div>
                    <span className="text-sm text-white/60">Updated 5 days ago</span>
                  </div>
                  <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: "30%" }}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/60">Progress</span>
                    <span className="text-sm font-medium text-primary">30%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10">
              <CardHeader>
                <CardTitle className="text-white">Recent Tasks</CardTitle>
                <CardDescription className="text-white/60">Your pending action items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/10">
                  <div className="mt-0.5 text-primary">
                    <Circle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white">Complete market research</h4>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>Due: Tomorrow</span>
                      </div>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400">High Priority</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/10">
                  <div className="mt-0.5 text-primary">
                    <Circle className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white">Schedule mentor meeting</h4>
                    <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>Due: Today</span>
                      </div>
                      <span>•</span>
                      <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400">High Priority</span>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="link" className="text-primary hover:text-primary/80 p-0">
                  View all tasks
                </Button>
              </CardFooter>
            </Card>
          </div>

          <Card className="glass-card border-primary/10">
            <CardHeader>
              <CardTitle className="text-white">Startup Metrics</CardTitle>
              <CardDescription className="text-white/60">Key performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                <div className="flex items-center justify-between p-4 rounded-lg border border-primary/10 bg-primary/5">
                  <div className="flex flex-col">
                    <span className="text-sm text-white/60">User Growth</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white">24%</span>
                      <span className="text-sm text-primary">+24%</span>
                    </div>
                  </div>
                  <LineChart className="h-5 w-5 text-primary" />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-primary/10 bg-primary/5">
                  <div className="flex flex-col">
                    <span className="text-sm text-white/60">Engagement</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white">12%</span>
                      <span className="text-sm text-primary">+12%</span>
                    </div>
                  </div>
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-primary/10 bg-primary/5">
                  <div className="flex flex-col">
                    <span className="text-sm text-white/60">Conversion</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white">8%</span>
                      <span className="text-sm text-primary">+8%</span>
                    </div>
                  </div>
                  <PieChart className="h-5 w-5 text-primary" />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-primary/10 bg-primary/5">
                  <div className="flex flex-col">
                    <span className="text-sm text-white/60">Retention</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white">18%</span>
                      <span className="text-sm text-primary">+18%</span>
                    </div>
                  </div>
                  <LineChart className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snapshot" className="space-y-6">
          <Card className="glass-card border-primary/10">
            <CardHeader>
              <CardTitle className="text-white">Startup Snapshot</CardTitle>
              <CardDescription className="text-white/60">Key metrics and indicators for your startup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  title="Waitlist Signups"
                  value="1,248"
                  change="+32% this month"
                  icon={<Users className="h-5 w-5" />}
                />
                <MetricCard
                  title="Runway"
                  value="8.5 months"
                  change="-0.5 from last month"
                  icon={<ClockIcon className="h-5 w-5" />}
                />
                <MetricCard
                  title="Monthly Burn Rate"
                  value="$42,500"
                  change="+$2,500 from last month"
                  icon={<DollarSign className="h-5 w-5" />}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <BentoCard title="Funding Status" icon={<Briefcase className="h-5 w-5" />}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80">Pre-seed Round</span>
                      <span className="text-primary font-medium">$350,000</span>
                    </div>
                    <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "70%" }}></div>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/60">Target: $500,000</span>
                      <span className="text-white/60">70% Complete</span>
                    </div>
                    <div className="pt-2">
                      <p className="text-white/80 text-sm">
                        Next investor meeting: <span className="text-primary">May 15, 2023</span>
                      </p>
                    </div>
                  </div>
                </BentoCard>

                <BentoCard title="Customer Acquisition" icon={<TrendingUp className="h-5 w-5" />}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-white/60 text-sm">CAC</p>
                        <p className="text-white text-xl font-medium">$42</p>
                        <p className="text-primary text-xs">-12% from last month</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-white/60 text-sm">LTV</p>
                        <p className="text-white text-xl font-medium">$285</p>
                        <p className="text-primary text-xs">+8% from last month</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-white/60 text-sm">Conversion Rate</p>
                        <p className="text-white text-xl font-medium">3.2%</p>
                        <p className="text-primary text-xs">+0.5% from last month</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-white/60 text-sm">LTV:CAC Ratio</p>
                        <p className="text-white text-xl font-medium">6.8:1</p>
                        <p className="text-primary text-xs">+1.2 from last month</p>
                      </div>
                    </div>
                  </div>
                </BentoCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  title="Active Users"
                  value="842"
                  change="+18% this month"
                  icon={<Users className="h-5 w-5" />}
                />
                <MetricCard
                  title="Churn Rate"
                  value="2.4%"
                  change="-0.3% from last month"
                  icon={<TrendingUp className="h-5 w-5" />}
                />
                <MetricCard
                  title="NPS Score"
                  value="72"
                  change="+5 points from last survey"
                  icon={<Award className="h-5 w-5" />}
                />
              </div>

              <BentoCard title="Market Penetration" icon={<PieChart className="h-5 w-5" />}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/80">North America</span>
                        <span className="text-primary">68%</span>
                      </div>
                      <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: "68%" }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/80">Europe</span>
                        <span className="text-primary">24%</span>
                      </div>
                      <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: "24%" }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/80">Asia-Pacific</span>
                        <span className="text-primary">8%</span>
                      </div>
                      <div className="h-2 w-full bg-primary/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: "8%" }}></div>
                      </div>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm">Target markets by current user distribution</p>
                </div>
              </BentoCard>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <div className="text-center py-12 glass-card border border-primary/10 rounded-lg">
            <h3 className="text-xl font-medium text-white">Projects Tab Content</h3>
            <p className="text-white/60 mt-2">This tab would display all your projects in detail.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Circle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
