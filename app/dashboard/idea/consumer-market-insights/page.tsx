"use client"

import { useState } from "react"
import { BarChart4, ChevronDown, ChevronUp, Filter, LineChart, PieChart, Search, Users } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ConsumerInsightsCards } from "@/components/visualizations/consumer-insights-cards"

export default function ConsumerMarketInsightsPage() {
  const [expandedSections, setExpandedSections] = useState({
    demographics: true,
    psychographics: true,
    behaviors: true,
    needs: true,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Consumer & Market Insights</h1>
        <p className="text-muted-foreground">
          Understand your target consumers and market dynamics to inform your product strategy.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search insights..." className="w-full pl-8" />
        </div>
        <Button variant="outline" className="flex gap-2">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
        </Button>
      </div>

      {/* Consumer Insights Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Consumer Insights Overview
          </CardTitle>
          <CardDescription>Key insights about your target consumers</CardDescription>
        </CardHeader>
        <CardContent>
          <ConsumerInsightsCards />
        </CardContent>
      </Card>

      {/* Demographics Section */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => toggleSection("demographics")}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Demographics
            </CardTitle>
            {expandedSections.demographics ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <CardDescription>Age, gender, location, income, and education</CardDescription>
        </CardHeader>
        {expandedSections.demographics && (
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-4 text-lg font-medium">Age Distribution</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">18-24</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                    <Progress value={15} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">25-34</span>
                      <span className="text-sm font-medium">40%</span>
                    </div>
                    <Progress value={40} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">35-44</span>
                      <span className="text-sm font-medium">30%</span>
                    </div>
                    <Progress value={30} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">45-54</span>
                      <span className="text-sm font-medium">10%</span>
                    </div>
                    <Progress value={10} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">55+</span>
                      <span className="text-sm font-medium">5%</span>
                    </div>
                    <Progress value={5} className="h-2" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="mb-4 text-lg font-medium">Income Level</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Under $50k</span>
                      <span className="text-sm font-medium">20%</span>
                    </div>
                    <Progress value={20} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">$50k - $75k</span>
                      <span className="text-sm font-medium">25%</span>
                    </div>
                    <Progress value={25} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">$75k - $100k</span>
                      <span className="text-sm font-medium">30%</span>
                    </div>
                    <Progress value={30} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">$100k - $150k</span>
                      <span className="text-sm font-medium">15%</span>
                    </div>
                    <Progress value={15} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">$150k+</span>
                      <span className="text-sm font-medium">10%</span>
                    </div>
                    <Progress value={10} className="h-2" />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="mb-4 text-lg font-medium">Geographic Distribution</h3>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Urban</p>
                  <p className="text-2xl font-bold">45%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Suburban</p>
                  <p className="text-2xl font-bold">35%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">Rural</p>
                  <p className="text-2xl font-bold">15%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="font-medium">International</p>
                  <p className="text-2xl font-bold">5%</p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Psychographics Section */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => toggleSection("psychographics")}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart4 className="h-5 w-5 text-primary" />
              Psychographics
            </CardTitle>
            {expandedSections.psychographics ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <CardDescription>Values, interests, attitudes, and lifestyle</CardDescription>
        </CardHeader>
        {expandedSections.psychographics && (
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="mb-4 text-lg font-medium">Values & Interests</h3>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Innovation</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={85} className="h-2 flex-1" />
                      <span className="text-sm font-medium">85%</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Technology</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={90} className="h-2 flex-1" />
                      <span className="text-sm font-medium">90%</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Sustainability</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={65} className="h-2 flex-1" />
                      <span className="text-sm font-medium">65%</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Work-Life Balance</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={75} className="h-2 flex-1" />
                      <span className="text-sm font-medium">75%</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Social Impact</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={60} className="h-2 flex-1" />
                      <span className="text-sm font-medium">60%</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Personal Growth</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={80} className="h-2 flex-1" />
                      <span className="text-sm font-medium">80%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-medium">Lifestyle Segments</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border p-4">
                    <p className="font-medium">Tech Enthusiasts</p>
                    <p className="mt-1 text-2xl font-bold">35%</p>
                    <p className="mt-1 text-sm text-muted-foreground">Early adopters who embrace new technologies</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="font-medium">Busy Professionals</p>
                    <p className="mt-1 text-2xl font-bold">30%</p>
                    <p className="mt-1 text-sm text-muted-foreground">Career-focused individuals seeking efficiency</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="font-medium">Conscious Consumers</p>
                    <p className="mt-1 text-2xl font-bold">20%</p>
                    <p className="mt-1 text-sm text-muted-foreground">Value-driven decision makers</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="font-medium">Digital Natives</p>
                    <p className="mt-1 text-2xl font-bold">15%</p>
                    <p className="mt-1 text-sm text-muted-foreground">Young adults who grew up with technology</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Behaviors Section */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => toggleSection("behaviors")}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Behaviors
            </CardTitle>
            {expandedSections.behaviors ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <CardDescription>Usage patterns, purchase behaviors, and decision factors</CardDescription>
        </CardHeader>
        {expandedSections.behaviors && (
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="mb-4 text-lg font-medium">Purchase Decision Factors</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Price</span>
                      <span className="text-sm font-medium">75%</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Features</span>
                      <span className="text-sm font-medium">85%</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ease of Use</span>
                      <span className="text-sm font-medium">90%</span>
                    </div>
                    <Progress value={90} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Brand Reputation</span>
                      <span className="text-sm font-medium">65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Customer Support</span>
                      <span className="text-sm font-medium">70%</span>
                    </div>
                    <Progress value={70} className="h-2" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-medium">Usage Patterns</h3>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Daily Active Users</p>
                    <p className="mt-1 text-2xl font-bold">45%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Weekly Active Users</p>
                    <p className="mt-1 text-2xl font-bold">30%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Monthly Active Users</p>
                    <p className="mt-1 text-2xl font-bold">25%</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Average Session Duration</p>
                    <p className="mt-1 text-2xl font-bold">18 minutes</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Average Sessions Per User</p>
                    <p className="mt-1 text-2xl font-bold">3.5 per week</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Needs & Pain Points Section */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => toggleSection("needs")}>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Needs & Pain Points
            </CardTitle>
            {expandedSections.needs ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <CardDescription>Key consumer needs, pain points, and opportunities</CardDescription>
        </CardHeader>
        {expandedSections.needs && (
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-lg font-medium">Top Pain Points</h3>
                  <div className="space-y-4">
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Time Constraints</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Consumers struggle with limited time for complex tasks
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium">Severity:</span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          High
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Technical Complexity</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Difficulty understanding and using technical solutions
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium">Severity:</span>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          High
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Cost Concerns</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sensitivity to pricing and return on investment
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium">Severity:</span>
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Medium
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-4 text-lg font-medium">Key Needs</h3>
                  <div className="space-y-4">
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Efficiency</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Solutions that save time and streamline processes
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium">Priority:</span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          High
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Simplicity</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Easy-to-use interfaces with minimal learning curve
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium">Priority:</span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          High
                        </span>
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="font-medium">Value</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Clear ROI and tangible benefits from solutions
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs font-medium">Priority:</span>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          High
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-lg font-medium">Opportunity Areas</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Automation Solutions</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tools that automate repetitive tasks and workflows
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Potential:</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Very High
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Integrated Platforms</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      All-in-one solutions that reduce tool switching
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Potential:</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Very High
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Educational Resources</p>
                    <p className="mt-1 text-sm text-muted-foreground">Simplified learning materials and onboarding</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs font-medium">Potential:</span>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        High
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Full Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Full Analysis</CardTitle>
          <CardDescription>Comprehensive consumer and market analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="segments">Segments</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">Market Overview</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  The target market shows strong growth potential with increasing demand for efficiency-focused
                  solutions. Key consumer segments are tech-savvy professionals who value time-saving and simplified
                  experiences.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Primary research indicates that 85% of potential users express frustration with current solutions in
                  the market, creating a significant opportunity for new entrants that address the identified pain
                  points.
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="font-medium">Market Size</p>
                    <p className="mt-1 text-2xl font-bold">$4.2B</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="font-medium">Growth Rate</p>
                    <p className="mt-1 text-2xl font-bold">18.5%</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="font-medium">TAM</p>
                    <p className="mt-1 text-2xl font-bold">$12.8B</p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="segments" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">Consumer Segments</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Analysis reveals four distinct consumer segments with varying needs and behaviors.
                </p>

                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Segment 1: Power Users</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tech-savvy professionals who prioritize advanced features and customization. They represent 25% of
                      the target market and have the highest lifetime value.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Segment 2: Efficiency Seekers</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Busy professionals looking for time-saving solutions with minimal learning curve. They represent
                      40% of the target market and are the fastest growing segment.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Segment 3: Value Hunters</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Price-sensitive users who need clear ROI justification. They represent 20% of the target market
                      and require the most convincing.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Segment 4: Novice Users</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Less tech-savvy individuals who prioritize simplicity and support. They represent 15% of the
                      target market and have the highest support costs.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="trends" className="mt-4 space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="text-lg font-medium">Market Trends</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Key trends shaping consumer behavior and market dynamics.
                </p>

                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Trend 1: AI Integration</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Increasing demand for AI-powered features that provide predictive insights and automate complex
                      decisions. 78% of consumers express interest in AI capabilities.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Trend 2: Mobile-First Experience</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Growing preference for mobile-optimized solutions that enable on-the-go productivity. Mobile usage
                      has increased 45% year-over-year in this category.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Trend 3: Subscription Models</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Shift from one-time purchases to subscription-based pricing models. 65% of consumers prefer
                      monthly or annual subscriptions over perpetual licenses.
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-medium">Trend 4: Integration Ecosystems</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Increasing importance of seamless integration with existing tools and workflows. 92% of potential
                      customers cite integration capabilities as a critical factor.
                    </p>
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
