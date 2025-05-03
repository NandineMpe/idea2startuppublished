"use client"

import { useState } from "react"
import {
  BarChart4,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  MapPin,
  PieChart,
  Target,
  Users,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { GlobeIcon } from "@/utils/icon-utils"

export default function GoToMarketPage() {
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Go-To-Market Strategy</h1>
        <p className="text-muted-foreground">
          Develop and refine your go-to-market approach to effectively reach your target customers.
        </p>
      </div>

      {/* Market Definition Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Market Definition
          </CardTitle>
          <CardDescription>Define your target market and positioning strategy</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Target Market</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Primary Audience</p>
                  <p className="text-sm text-muted-foreground">
                    Small to medium-sized businesses looking to optimize their operations
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Secondary Audience</p>
                  <p className="text-sm text-muted-foreground">
                    Enterprise organizations seeking departmental solutions
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Positioning</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Value Proposition</p>
                  <p className="text-sm text-muted-foreground">
                    Streamline business processes with AI-powered insights and automation
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Differentiation</p>
                  <p className="text-sm text-muted-foreground">
                    Unique combination of ease-of-use and enterprise-grade capabilities
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Market Expansion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GlobeIcon className="h-5 w-5 text-primary" />
            Global Market Expansion
          </CardTitle>
          <CardDescription>Prioritized regions for market entry and expansion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">North America</span>
                </div>
                <span className="text-sm font-medium">Phase 1</span>
              </div>
              <Progress value={100} className="h-2" />
              <p className="text-xs text-muted-foreground">Initial launch market with established presence</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">Western Europe</span>
                </div>
                <span className="text-sm font-medium">Phase 2</span>
              </div>
              <Progress value={75} className="h-2" />
              <p className="text-xs text-muted-foreground">Expansion underway with localization efforts</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span className="font-medium">Asia Pacific</span>
                </div>
                <span className="text-sm font-medium">Phase 3</span>
              </div>
              <Progress value={25} className="h-2" />
              <p className="text-xs text-muted-foreground">Market research and partnership development</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GTM Readiness Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart4 className="h-5 w-5 text-primary" />
            GTM Readiness Score
          </CardTitle>
          <CardDescription>Assessment of your go-to-market readiness across key dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Product Readiness</span>
                <span className="text-sm font-medium">85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Marketing Readiness</span>
                <span className="text-sm font-medium">70%</span>
              </div>
              <Progress value={70} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Sales Readiness</span>
                <span className="text-sm font-medium">60%</span>
              </div>
              <Progress value={60} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Customer Success Readiness</span>
                <span className="text-sm font-medium">75%</span>
              </div>
              <Progress value={75} className="h-2" />
            </div>

            <div className="mt-6 flex items-center justify-between rounded-lg bg-muted p-3">
              <div className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                <span className="font-medium">Overall GTM Readiness</span>
              </div>
              <span className="text-lg font-bold">72%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Go-To-Market Tools */}
      <Card>
        <CardHeader>
          <CardTitle>Go-To-Market Tools</CardTitle>
          <CardDescription>Resources to help you execute your go-to-market strategy</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="channels">Channels</TabsTrigger>
              <TabsTrigger value="messaging">Messaging</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">GTM Strategy Overview</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your go-to-market strategy focuses on a product-led growth approach with strong emphasis on digital
                  marketing channels and strategic partnerships.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <Compass className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Market Entry Approach</p>
                      <p className="text-sm text-muted-foreground">
                        Freemium model with focus on user acquisition and conversion
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">Timeline</p>
                      <p className="text-sm text-muted-foreground">6-month phased rollout with key milestones</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    className="flex items-center gap-1 text-sm font-medium text-primary"
                    onClick={() => setActiveTab("timeline")}
                  >
                    View Timeline <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">GTM Timeline</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Strategic timeline for your product launch and market expansion activities.
                </p>

                <div className="mt-6 space-y-6">
                  <div className="relative pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-border">
                    <div className="absolute left-0 top-0 -translate-x-1/2 rounded-full bg-primary p-1">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                    </div>
                    <div>
                      <p className="font-medium">Pre-Launch Phase</p>
                      <p className="text-sm text-muted-foreground">Month 1-2</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                        <li>Beta testing with select customers</li>
                        <li>Marketing content development</li>
                        <li>Sales enablement preparation</li>
                      </ul>
                    </div>
                  </div>

                  <div className="relative pl-6 before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-border">
                    <div className="absolute left-0 top-0 -translate-x-1/2 rounded-full bg-primary p-1">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                    </div>
                    <div>
                      <p className="font-medium">Launch Phase</p>
                      <p className="text-sm text-muted-foreground">Month 3-4</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                        <li>Official product launch</li>
                        <li>PR and media outreach</li>
                        <li>Initial customer acquisition campaigns</li>
                      </ul>
                    </div>
                  </div>

                  <div className="relative pl-6">
                    <div className="absolute left-0 top-0 -translate-x-1/2 rounded-full bg-primary p-1">
                      <div className="h-2 w-2 rounded-full bg-primary"></div>
                    </div>
                    <div>
                      <p className="font-medium">Growth Phase</p>
                      <p className="text-sm text-muted-foreground">Month 5-6</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                        <li>Expansion to secondary markets</li>
                        <li>Partnership activations</li>
                        <li>Customer success program scaling</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="channels" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">Marketing Channels</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Prioritized marketing channels for customer acquisition and engagement.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <p className="font-medium">Content Marketing</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Blog posts, whitepapers, case studies focused on industry pain points
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Priority:</span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        High
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <p className="font-medium">Social Media</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      LinkedIn and Twitter focus with targeted campaigns for B2B audience
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Priority:</span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        High
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5">
                        <BarChart4 className="h-4 w-4 text-primary" />
                      </div>
                      <p className="font-medium">Paid Advertising</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Google Ads and LinkedIn Ads with industry-specific targeting
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Priority:</span>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        Medium
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <div className="rounded-full bg-primary/10 p-1.5">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <p className="font-medium">Events & Webinars</p>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Industry conferences and educational webinars</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Priority:</span>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        Medium
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="messaging" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">Messaging Framework</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Core messaging elements to ensure consistent communication across channels.
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="font-medium">Tagline</p>
                    <p className="text-sm text-muted-foreground">
                      "Transform your business with intelligent automation"
                    </p>
                  </div>

                  <div>
                    <p className="font-medium">Elevator Pitch</p>
                    <p className="text-sm text-muted-foreground">
                      Our platform helps businesses streamline operations through AI-powered automation, reducing costs
                      and improving efficiency without requiring technical expertise.
                    </p>
                  </div>

                  <div>
                    <p className="font-medium">Key Messages</p>
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      <li>Reduce operational costs by up to 30%</li>
                      <li>Implement in days, not months</li>
                      <li>No coding or technical expertise required</li>
                      <li>Enterprise-grade security and compliance</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium">Customer Pain Points Addressed</p>
                    <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                      <li>Manual, time-consuming processes</li>
                      <li>High operational costs</li>
                      <li>Difficulty implementing new technology</li>
                      <li>Lack of actionable business insights</li>
                    </ul>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
