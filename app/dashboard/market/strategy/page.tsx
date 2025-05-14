"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WorldMap } from "@/components/world-map"
import { Rocket, Globe, Users, ArrowRight, DollarSign, CheckCircle2, Network, Quote, BarChart3 } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function GoToMarketPage() {
  // Add state for active tab
  const [activeTab, setActiveTab] = useState("problem-solution-fit")
  const [domesticMarket, setDomesticMarket] = useState("us")
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(["uk", "jp", "au"])

  // Sample data for the world map
  const mapDots = [
    {
      start: { lat: 37.7749, lng: -122.4194, label: "San Francisco" }, // San Francisco
      end: { lat: 51.5074, lng: -0.1278, label: "London" }, // London
    },
    {
      start: { lat: 37.7749, lng: -122.4194, label: "San Francisco" }, // San Francisco
      end: { lat: 35.6762, lng: 139.6503, label: "Tokyo" }, // Tokyo
    },
    {
      start: { lat: 37.7749, lng: -122.4194, label: "San Francisco" }, // San Francisco
      end: { lat: -33.8688, lng: 151.2093, label: "Sydney" }, // Sydney
    },
  ]

  // Market data
  const domesticMarkets = [
    { value: "us", label: "United States", flag: "🇺🇸" },
    { value: "ca", label: "Canada", flag: "🇨🇦" },
    { value: "uk", label: "United Kingdom", flag: "🇬🇧" },
    { value: "au", label: "Australia", flag: "🇦🇺" },
    { value: "de", label: "Germany", flag: "🇩🇪" },
    { value: "fr", label: "France", flag: "🇫🇷" },
    { value: "jp", label: "Japan", flag: "🇯🇵" },
    { value: "sg", label: "Singapore", flag: "🇸🇬" },
  ]

  const geographicMarkets = [
    {
      continent: "North America",
      items: [
        { value: "us", label: "United States", flag: "🇺🇸" },
        { value: "ca", label: "Canada", flag: "🇨🇦" },
        { value: "mx", label: "Mexico", flag: "🇲🇽" },
      ],
    },
    {
      continent: "Europe",
      items: [
        { value: "uk", label: "United Kingdom", flag: "🇬🇧" },
        { value: "de", label: "Germany", flag: "🇩🇪" },
        { value: "fr", label: "France", flag: "🇫🇷" },
        { value: "es", label: "Spain", flag: "🇪🇸" },
        { value: "it", label: "Italy", flag: "🇮🇹" },
      ],
    },
    {
      continent: "Asia Pacific",
      items: [
        { value: "jp", label: "Japan", flag: "🇯🇵" },
        { value: "cn", label: "China", flag: "🇨🇳" },
        { value: "in", label: "India", flag: "🇮🇳" },
        { value: "sg", label: "Singapore", flag: "🇸🇬" },
        { value: "au", label: "Australia", flag: "🇦🇺" },
      ],
    },
    {
      continent: "Latin America",
      items: [
        { value: "br", label: "Brazil", flag: "🇧🇷" },
        { value: "ar", label: "Argentina", flag: "🇦🇷" },
        { value: "co", label: "Colombia", flag: "🇨🇴" },
        { value: "cl", label: "Chile", flag: "🇨🇱" },
      ],
    },
    {
      continent: "Middle East & Africa",
      items: [
        { value: "ae", label: "UAE", flag: "🇦🇪" },
        { value: "sa", label: "Saudi Arabia", flag: "🇸🇦" },
        { value: "za", label: "South Africa", flag: "🇿🇦" },
        { value: "ng", label: "Nigeria", flag: "🇳🇬" },
      ],
    },
  ]

  const handleAddMarket = (market: string) => {
    if (!selectedMarkets.includes(market)) {
      setSelectedMarkets([...selectedMarkets, market])
    }
  }

  const handleRemoveMarket = (market: string) => {
    setSelectedMarkets(selectedMarkets.filter((m) => m !== market))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            Go-To-Market Strategy
          </h1>
        </div>
      </div>

      {/* Condensed Market Definition Section */}
      <Card className="glass-card border-primary/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <Network className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">What is a Market?</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/50 border border-gray-800 rounded-lg p-4 hover:border-primary/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-primary/10 p-1.5 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-primary">Shared Need</h3>
                </div>
                <p className="text-white/80 text-sm">Share a common need or desire that your product can address</p>
              </div>

              <div className="bg-black/50 border border-gray-800 rounded-lg p-4 hover:border-primary/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-primary/10 p-1.5 rounded-full">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-primary">Purchasing Power</h3>
                </div>
                <p className="text-white/80 text-sm">Are willing to spend money to resolve that need</p>
              </div>

              <div className="bg-black/50 border border-gray-800 rounded-lg p-4 hover:border-primary/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-primary/10 p-1.5 rounded-full">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-primary">Mutual Influence</h3>
                </div>
                <p className="text-white/80 text-sm">
                  Crucially, influence each other when making purchasing decisions
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Quote className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <p className="text-sm italic text-white">
                  "When a great team meets a bad market, the market wins. When a bad team meets a great market—something
                  special happens." <span className="text-primary font-medium">— Andy Rachleff</span>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="glass-card border-primary/10 lg:col-span-2">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>Global Market Expansion</CardTitle>
                  <CardDescription>Visualize your market entry strategy across different regions</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="domestic-market">Domestic Market</Label>
                <Select value={domesticMarket} onValueChange={setDomesticMarket}>
                  <SelectTrigger
                    id="domestic-market"
                    className="glass-input text-white border-primary/10 focus-visible:ring-primary/30 [&>span]:flex [&>span]:items-center [&>span]:gap-2"
                  >
                    <SelectValue placeholder="Select domestic market" />
                  </SelectTrigger>
                  <SelectContent className="glass border-primary/10 [&_*[role=option]>span]:flex [&_*[role=option]>span]:items-center [&_*[role=option]>span]:gap-2">
                    {domesticMarkets.map((market) => (
                      <SelectItem key={market.value} value={market.value}>
                        <span className="text-lg leading-none">{market.flag}</span>{" "}
                        <span className="truncate">{market.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-market">Add Geographic Market</Label>
                <Select onValueChange={handleAddMarket}>
                  <SelectTrigger
                    id="add-market"
                    className="glass-input text-white border-primary/10 focus-visible:ring-primary/30 [&>span]:flex [&>span]:items-center [&>span]:gap-2"
                  >
                    <SelectValue placeholder="Select market to add" />
                  </SelectTrigger>
                  <SelectContent className="glass border-primary/10 [&_*[role=option]>span]:flex [&_*[role=option]>span]:items-center [&_*[role=option]>span]:gap-2">
                    {geographicMarkets.map((continent) => (
                      <SelectGroup key={continent.continent}>
                        <SelectLabel>{continent.continent}</SelectLabel>
                        {continent.items.map((market) => (
                          <SelectItem key={market.value} value={market.value}>
                            <span className="text-lg leading-none">{market.flag}</span>{" "}
                            <span className="truncate">{market.label}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-4">
              <Label className="mb-2 block">Selected Target Markets</Label>
              <div className="flex flex-wrap gap-2">
                {selectedMarkets.map((marketCode) => {
                  // Find the market details from all geographic markets
                  let marketDetails = null
                  for (const continent of geographicMarkets) {
                    const found = continent.items.find((item) => item.value === marketCode)
                    if (found) {
                      marketDetails = found
                      break
                    }
                  }

                  // If not found in geographic markets, check domestic markets
                  if (!marketDetails) {
                    marketDetails = domesticMarkets.find((item) => item.value === marketCode)
                  }

                  if (!marketDetails) return null

                  return (
                    <div
                      key={marketCode}
                      className="flex items-center gap-1.5 bg-black/50 text-white px-3 py-1.5 rounded-full text-sm"
                    >
                      <span className="text-base">{marketDetails.flag}</span>
                      <span>{marketDetails.label}</span>
                      <button
                        onClick={() => handleRemoveMarket(marketCode)}
                        className="ml-1.5 text-white/60 hover:text-white"
                      >
                        <span className="sr-only">Remove</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 6 6 18"></path>
                          <path d="m6 6 12 12"></path>
                        </svg>
                      </button>
                    </div>
                  )
                })}

                {selectedMarkets.length === 0 && (
                  <div className="text-white/60 text-sm">No target markets selected. Add markets above.</div>
                )}
              </div>
            </div>

            <WorldMap dots={mapDots} lineColor="#32CD32" />
          </CardContent>
        </Card>

        <Card className="glass-card border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-full">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>GTM Readiness</CardTitle>
                <CardDescription>Your go-to-market readiness score</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 mb-4">
                <div className="absolute inset-0 rounded-full bg-black/50"></div>
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-primary/70"
                  style={{ clipPath: "polygon(0 0, 65% 0, 65% 100%, 0 100%)" }}
                ></div>
                <div className="absolute inset-2 rounded-full bg-black flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">65%</span>
                </div>
              </div>
              <p className="text-center text-white/80 mb-4">
                Your GTM plan is on track, but there are a few areas that need attention.
              </p>
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white">Market Research</span>
                  <span className="text-primary">85%</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "85%" }}></div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-white">Pricing Strategy</span>
                  <span className="text-primary">70%</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "70%" }}></div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-white">Channel Strategy</span>
                  <span className="text-primary">40%</span>
                </div>
                <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: "40%" }}></div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-black/30 border-t border-primary/10 px-6 py-3">
            <Button className="w-full bg-primary hover:bg-primary/90 text-black">Improve Your Score</Button>
          </CardFooter>
        </Card>
      </div>

      {/* Replace the grid of cards with tabs */}
      <Card className="glass-card border-primary/10">
        <CardHeader>
          <CardTitle>Go-To-Market Tools</CardTitle>
          <CardDescription>Select a tool to help build your go-to-market strategy</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-black/50 rounded-lg h-auto p-1">
              <TabsTrigger
                value="problem-solution-fit"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Problem Solution Fit
              </TabsTrigger>
              <TabsTrigger
                value="product-market-fit"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Product Market Fit
              </TabsTrigger>
              <TabsTrigger
                value="customer-acquisition"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Customer Acquisition
              </TabsTrigger>
              <TabsTrigger
                value="scaling-plan"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
              >
                Scaling Plan
              </TabsTrigger>
            </TabsList>

            <TabsContent value="problem-solution-fit" className="mt-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold text-white mb-2">Problem Solution Fit</h3>
                  <p className="text-white/80 mb-4">
                    Validate that your solution actually solves a real, meaningful problem for your target audience.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Problem Discovery</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">
                      Solution Validation
                    </span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">User Interviews</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Early Feedback</span>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-black">
                    Assess Fit <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="product-market-fit" className="mt-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold text-white mb-2">Product Market Fit</h3>
                  <p className="text-white/80 mb-4">
                    Demonstrate that your product satisfies a strong market demand and users are willing to pay for it.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Retention</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Engagement</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">NPS</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Revenue</span>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-black">
                    Measure PMF <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="customer-acquisition" className="mt-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold text-white mb-2">Customer Acquisition</h3>
                  <p className="text-white/80 mb-4">Create a strategy to acquire and retain your first customers.</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Acquisition</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Activation</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Retention</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Referral</span>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-black">
                    Plan Acquisition <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scaling-plan" className="mt-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-extrabold text-white mb-2">Scaling Plan</h3>
                  <p className="text-white/80 mb-4">Develop a plan for scaling operations, team, and market reach.</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Growth Loops</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Team</span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">
                      Internationalization
                    </span>
                    <span className="text-xs bg-black/50 text-white/80 px-2 py-1 rounded-full">Process</span>
                  </div>
                  <Button className="bg-primary hover:bg-primary/90 text-black">
                    Build Scaling Plan <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
