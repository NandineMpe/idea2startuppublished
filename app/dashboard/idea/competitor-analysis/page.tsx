"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, CheckCircle2, XCircle, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlobeIcon } from "@/utils/icon-utils"

// Mock data for competitor analysis
const competitorData = [
  {
    name: "Your Solution",
    description: "Innovative AI-powered platform for streamlining business operations",
    marketShare: 15,
    strengths: ["User-friendly interface", "Affordable pricing", "Excellent customer support", "Regular updates"],
    weaknesses: ["Newer to market", "Fewer integrations", "Limited enterprise features"],
    targetMarkets: ["Small businesses", "Mid-market companies", "Technology sector"],
    pricing: {
      starter: "$29/month",
      professional: "$79/month",
      enterprise: "$199/month",
    },
    features: {
      automation: true,
      analytics: true,
      collaboration: true,
      customization: true,
      apiAccess: true,
      enterpriseSupport: false,
    },
  },
  {
    name: "Competitor A",
    description: "Established platform with comprehensive enterprise solutions",
    marketShare: 35,
    strengths: ["Market leader", "Comprehensive feature set", "Strong enterprise focus", "Wide integration ecosystem"],
    weaknesses: ["Expensive", "Complex interface", "Slow customer support", "Lengthy implementation"],
    targetMarkets: ["Enterprise", "Financial services", "Healthcare", "Manufacturing"],
    pricing: {
      starter: "$49/month",
      professional: "$149/month",
      enterprise: "$499/month",
    },
    features: {
      automation: true,
      analytics: true,
      collaboration: true,
      customization: true,
      apiAccess: true,
      enterpriseSupport: true,
    },
  },
  {
    name: "Competitor B",
    description: "Budget-friendly solution with basic functionality",
    marketShare: 20,
    strengths: ["Low cost", "Simple to use", "Quick setup", "Good for small teams"],
    weaknesses: ["Limited features", "Basic reporting", "Minimal customization", "Infrequent updates"],
    targetMarkets: ["Startups", "Small businesses", "Freelancers"],
    pricing: {
      starter: "$19/month",
      professional: "$49/month",
      enterprise: "Contact sales",
    },
    features: {
      automation: true,
      analytics: false,
      collaboration: true,
      customization: false,
      apiAccess: false,
      enterpriseSupport: false,
    },
  },
  {
    name: "Competitor C",
    description: "Specialized solution with advanced analytics capabilities",
    marketShare: 18,
    strengths: ["Advanced analytics", "Data visualization", "Industry-specific features", "Strong security"],
    weaknesses: ["Narrow focus", "Steep learning curve", "Higher pricing", "Limited collaboration tools"],
    targetMarkets: ["Data-driven organizations", "Research institutions", "Technology companies"],
    pricing: {
      starter: "$39/month",
      professional: "$99/month",
      enterprise: "$299/month",
    },
    features: {
      automation: false,
      analytics: true,
      collaboration: false,
      customization: true,
      apiAccess: true,
      enterpriseSupport: true,
    },
  },
]

export default function CompetitorAnalysisPage() {
  const [selectedCompetitors, setSelectedCompetitors] = useState(["Your Solution", "Competitor A", "Competitor B"])

  const toggleCompetitor = (name: string) => {
    if (selectedCompetitors.includes(name)) {
      // Don't allow deselecting "Your Solution"
      if (name === "Your Solution") return
      setSelectedCompetitors(selectedCompetitors.filter((c) => c !== name))
    } else {
      setSelectedCompetitors([...selectedCompetitors, name])
    }
  }

  const filteredCompetitors = competitorData.filter((c) => selectedCompetitors.includes(c.name))

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Competitor Analysis</h1>
        <p className="text-white/60">Compare your solution against market competitors</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {competitorData.map((competitor) => (
          <Button
            key={competitor.name}
            variant={selectedCompetitors.includes(competitor.name) ? "default" : "outline"}
            className={
              selectedCompetitors.includes(competitor.name)
                ? "bg-primary text-black hover:bg-primary/90"
                : "border-gray-800 hover:bg-gray-800"
            }
            onClick={() => toggleCompetitor(competitor.name)}
            disabled={competitor.name === "Your Solution"} // Can't deselect your own solution
          >
            {competitor.name}
          </Button>
        ))}
      </div>

      <Card className="glass-card border-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-[#00ff9d]" />
            <CardTitle>Market Position</CardTitle>
          </div>
          <CardDescription>Market share and positioning analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="mb-4 text-lg font-medium">Market Share Comparison</h3>
            <div className="space-y-4">
              {filteredCompetitors.map((competitor) => (
                <div key={competitor.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={competitor.name === "Your Solution" ? "font-bold text-primary" : "text-white/80"}>
                      {competitor.name}
                    </span>
                    <span>{competitor.marketShare}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                    <div
                      className={`h-full ${competitor.name === "Your Solution" ? "bg-primary" : "bg-blue-500/70"}`}
                      style={{ width: `${competitor.marketShare}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-lg font-medium">Target Markets</h3>
              <div className="rounded-lg border border-primary/10 bg-black/30 p-4">
                <div className="space-y-4">
                  {filteredCompetitors.map((competitor) => (
                    <div key={competitor.name}>
                      <h4
                        className={`mb-2 text-sm font-medium ${
                          competitor.name === "Your Solution" ? "text-primary" : ""
                        }`}
                      >
                        {competitor.name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {competitor.targetMarkets.map((market) => (
                          <span key={market} className="rounded-full bg-gray-800 px-2 py-1 text-xs text-white/80">
                            {market}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-4 text-lg font-medium">Pricing Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-full table-fixed border-collapse">
                  <thead>
                    <tr>
                      <th className="w-1/4 border-b border-gray-800 pb-2 text-left text-sm font-medium">Company</th>
                      <th className="w-1/4 border-b border-gray-800 pb-2 text-left text-sm font-medium">Starter</th>
                      <th className="w-1/4 border-b border-gray-800 pb-2 text-left text-sm font-medium">
                        Professional
                      </th>
                      <th className="w-1/4 border-b border-gray-800 pb-2 text-left text-sm font-medium">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompetitors.map((competitor) => (
                      <tr key={competitor.name}>
                        <td
                          className={`py-2 text-sm ${
                            competitor.name === "Your Solution" ? "font-bold text-primary" : ""
                          }`}
                        >
                          {competitor.name}
                        </td>
                        <td className="py-2 text-sm">{competitor.pricing.starter}</td>
                        <td className="py-2 text-sm">{competitor.pricing.professional}</td>
                        <td className="py-2 text-sm">{competitor.pricing.enterprise}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-primary/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GlobeIcon className="h-5 w-5 text-[#00ff9d]" />
            <CardTitle>Competitive Analysis</CardTitle>
          </div>
          <CardDescription>Strengths and weaknesses comparison</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="strengths">
            <TabsList className="mb-4 w-full justify-start border-b border-gray-800 bg-transparent p-0">
              <TabsTrigger
                value="strengths"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Strengths
              </TabsTrigger>
              <TabsTrigger
                value="weaknesses"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Weaknesses
              </TabsTrigger>
              <TabsTrigger
                value="features"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                Feature Comparison
              </TabsTrigger>
            </TabsList>

            <TabsContent value="strengths" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2">
                {filteredCompetitors.map((competitor) => (
                  <div key={competitor.name} className="rounded-lg border border-primary/10 bg-black/30 p-4">
                    <h3
                      className={`mb-3 text-lg font-medium ${
                        competitor.name === "Your Solution" ? "text-primary" : ""
                      }`}
                    >
                      {competitor.name}
                    </h3>
                    <p className="mb-3 text-sm text-white/70">{competitor.description}</p>
                    <h4 className="mb-2 text-sm font-medium">Key Strengths</h4>
                    <ul className="space-y-1">
                      {competitor.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-white/80">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="weaknesses" className="mt-0">
              <div className="grid gap-4 md:grid-cols-2">
                {filteredCompetitors.map((competitor) => (
                  <div key={competitor.name} className="rounded-lg border border-primary/10 bg-black/30 p-4">
                    <h3
                      className={`mb-3 text-lg font-medium ${
                        competitor.name === "Your Solution" ? "text-primary" : ""
                      }`}
                    >
                      {competitor.name}
                    </h3>
                    <p className="mb-3 text-sm text-white/70">{competitor.description}</p>
                    <h4 className="mb-2 text-sm font-medium">Key Weaknesses</h4>
                    <ul className="space-y-1">
                      {competitor.weaknesses.map((weakness, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-white/80">
                          <XCircle className="mt-0.5 h-4 w-4 text-red-500" />
                          <span>{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="features" className="mt-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b border-gray-800 pb-2 text-left text-sm font-medium">Feature</th>
                      {filteredCompetitors.map((competitor) => (
                        <th
                          key={competitor.name}
                          className={`border-b border-gray-800 pb-2 text-left text-sm font-medium ${
                            competitor.name === "Your Solution" ? "text-primary" : ""
                          }`}
                        >
                          {competitor.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 text-sm">Automation</td>
                      {filteredCompetitors.map((competitor) => (
                        <td key={competitor.name} className="py-2 text-sm">
                          {competitor.features.automation ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-sm">Analytics</td>
                      {filteredCompetitors.map((competitor) => (
                        <td key={competitor.name} className="py-2 text-sm">
                          {competitor.features.analytics ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-sm">Collaboration</td>
                      {filteredCompetitors.map((competitor) => (
                        <td key={competitor.name} className="py-2 text-sm">
                          {competitor.features.collaboration ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-sm">Customization</td>
                      {filteredCompetitors.map((competitor) => (
                        <td key={competitor.name} className="py-2 text-sm">
                          {competitor.features.customization ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-sm">API Access</td>
                      {filteredCompetitors.map((competitor) => (
                        <td key={competitor.name} className="py-2 text-sm">
                          {competitor.features.apiAccess ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2 text-sm">Enterprise Support</td>
                      {filteredCompetitors.map((competitor) => (
                        <td key={competitor.name} className="py-2 text-sm">
                          {competitor.features.enterpriseSupport ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" className="border-gray-800 hover:bg-gray-800">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <Button variant="outline" className="border-gray-800 hover:bg-gray-800">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
