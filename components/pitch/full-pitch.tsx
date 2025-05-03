"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Download,
  Users,
  TrendingUp,
  DollarSign,
  BarChart,
  Target,
  Lightbulb,
  Clock,
  ArrowRight,
  CheckCircle2,
  Flag,
  HelpCircle,
  LineChart,
  Layers,
  Award,
} from "lucide-react"

export function FullPitch() {
  const [activeSection, setActiveSection] = useState("company-purpose")
  const [progress, setProgress] = useState(0)
  const [completedSections, setCompletedSections] = useState<string[]>([])

  const sections = [
    { id: "company-purpose", title: "Company Purpose", icon: <Flag className="h-5 w-5" /> },
    { id: "problem", title: "Problem", icon: <Lightbulb className="h-5 w-5" /> },
    { id: "solution", title: "Solution", icon: <Target className="h-5 w-5" /> },
    { id: "why-now", title: "Why Now?", icon: <HelpCircle className="h-5 w-5" /> },
    { id: "market-potential", title: "Market Potential", icon: <BarChart className="h-5 w-5" /> },
    { id: "competition", title: "Competition", icon: <TrendingUp className="h-5 w-5" /> },
    { id: "product-overview", title: "Product Overview", icon: <Layers className="h-5 w-5" /> },
    { id: "business-model", title: "Business Model", icon: <DollarSign className="h-5 w-5" /> },
    { id: "team", title: "Team", icon: <Users className="h-5 w-5" /> },
    { id: "financial-overview", title: "Financial Overview", icon: <LineChart className="h-5 w-5" /> },
    { id: "vision", title: "If It All Goes Right", icon: <Award className="h-5 w-5" /> },
  ]

  const handleSectionComplete = (sectionId: string) => {
    if (!completedSections.includes(sectionId)) {
      const newCompletedSections = [...completedSections, sectionId]
      setCompletedSections(newCompletedSections)
      setProgress(Math.round((newCompletedSections.length / sections.length) * 100))
    }
  }

  const handleNextSection = () => {
    const currentIndex = sections.findIndex((section) => section.id === activeSection)
    if (currentIndex < sections.length - 1) {
      setActiveSection(sections[currentIndex + 1].id)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle>Full Pitch Builder</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/60">{progress}% complete</span>
              <div className="w-32 h-2 bg-black/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          </div>
          <CardDescription>
            Build a comprehensive pitch by completing each section. Your progress is saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeSection} onValueChange={setActiveSection} className="w-full">
            <div className="flex overflow-x-auto pb-2 mb-6 scrollbar-hide">
              <TabsList className="bg-transparent p-0 h-auto flex space-x-2">
                {sections.map((section) => (
                  <TabsTrigger
                    key={section.id}
                    value={section.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                      activeSection === section.id
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-black/50 border-gray-800 text-white/60 hover:text-white"
                    }`}
                  >
                    {completedSections.includes(section.id) ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      section.icon
                    )}
                    <span>{section.title}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="company-purpose" className="mt-0">
              <CompanyPurposeSection
                onComplete={() => handleSectionComplete("company-purpose")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("company-purpose")}
              />
            </TabsContent>

            <TabsContent value="problem" className="mt-0">
              <ProblemSection
                onComplete={() => handleSectionComplete("problem")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("problem")}
              />
            </TabsContent>

            <TabsContent value="solution" className="mt-0">
              <SolutionSection
                onComplete={() => handleSectionComplete("solution")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("solution")}
              />
            </TabsContent>

            <TabsContent value="why-now" className="mt-0">
              <WhyNowSection
                onComplete={() => handleSectionComplete("why-now")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("why-now")}
              />
            </TabsContent>

            <TabsContent value="market-potential" className="mt-0">
              <MarketPotentialSection
                onComplete={() => handleSectionComplete("market-potential")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("market-potential")}
              />
            </TabsContent>

            <TabsContent value="competition" className="mt-0">
              <CompetitionSection
                onComplete={() => handleSectionComplete("competition")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("competition")}
              />
            </TabsContent>

            <TabsContent value="product-overview" className="mt-0">
              <ProductOverviewSection
                onComplete={() => handleSectionComplete("product-overview")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("product-overview")}
              />
            </TabsContent>

            <TabsContent value="business-model" className="mt-0">
              <BusinessModelSection
                onComplete={() => handleSectionComplete("business-model")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("business-model")}
              />
            </TabsContent>

            <TabsContent value="team" className="mt-0">
              <TeamSection
                onComplete={() => handleSectionComplete("team")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("team")}
              />
            </TabsContent>

            <TabsContent value="financial-overview" className="mt-0">
              <FinancialOverviewSection
                onComplete={() => handleSectionComplete("financial-overview")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("financial-overview")}
              />
            </TabsContent>

            <TabsContent value="vision" className="mt-0">
              <VisionSection
                onComplete={() => handleSectionComplete("vision")}
                isCompleted={completedSections.includes("vision")}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {progress === 100 && (
        <Card className="bg-primary/10 border-primary">
          <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-xl font-semibold text-primary mb-1">Your pitch is complete!</h3>
              <p className="text-white/80">
                You've completed all sections of your pitch. You can now download it or continue editing.
              </p>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-black whitespace-nowrap">
              <Download className="mr-2 h-4 w-4" />
              Download Full Pitch
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Section Components
function CompanyPurposeSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    purpose: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.purpose.length > 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Define your company in a single declarative sentence</label>
            <Textarea
              placeholder="We are building [PRODUCT] to help [TARGET CUSTOMER] solve [PROBLEM] by [VALUE PROPOSITION]."
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.purpose}
              onChange={(e) => handleInputChange("purpose", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Company Purpose Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Be Concise</h4>
                <p className="text-sm text-white/60">
                  Your company purpose should be clear and memorable in a single sentence.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Focus on Impact</h4>
                <p className="text-sm text-white/60">
                  Explain the fundamental change or improvement your company brings to the world.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Avoid Jargon</h4>
                <p className="text-sm text-white/60">Use simple, powerful language that anyone can understand.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Example</h4>
                <p className="text-sm text-white/60 italic">
                  "We're building an AI-powered platform that helps small businesses automate customer support, saving
                  them time and money while improving customer satisfaction."
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ProblemSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    painPoints: "",
    currentSolutions: "",
    shortcomings: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.painPoints && formData.currentSolutions

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Describe the pain points of your customer</label>
            <Textarea
              placeholder="What specific problems or challenges do your customers face?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.painPoints}
              onChange={(e) => handleInputChange("painPoints", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">How is this addressed today?</label>
            <Textarea
              placeholder="Describe current solutions or workarounds that exist in the market"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.currentSolutions}
              onChange={(e) => handleInputChange("currentSolutions", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What are the shortcomings to current solutions?</label>
            <Textarea
              placeholder="Explain the limitations, inefficiencies, or gaps in existing solutions"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.shortcomings}
              onChange={(e) => handleInputChange("shortcomings", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Problem Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Be Specific</h4>
                <p className="text-sm text-white/60">
                  Define the exact problem you're solving, not just a general area.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Use Data</h4>
                <p className="text-sm text-white/60">
                  Include statistics or research that quantify the problem's scope.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Tell a Story</h4>
                <p className="text-sm text-white/60">
                  Frame the problem through a relatable customer story or scenario.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Highlight Urgency</h4>
                <p className="text-sm text-white/60">Explain why this problem needs to be solved now, not later.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SolutionSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    eureka: "",
    valueProposition: "",
    practicalUses: "",
    future: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.eureka && formData.valueProposition

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Explain your eureka moment</label>
            <Textarea
              placeholder="What insight or realization led to your solution?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.eureka}
              onChange={(e) => handleInputChange("eureka", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Describe the value proposition</label>
            <Textarea
              placeholder="What unique value does your solution provide to customers?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.valueProposition}
              onChange={(e) => handleInputChange("valueProposition", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Practical uses of the product for the customer</label>
            <Textarea
              placeholder="How will customers use your product in their daily lives or operations?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.practicalUses}
              onChange={(e) => handleInputChange("practicalUses", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Why will it endure? And where does it go from here?</label>
            <Textarea
              placeholder="Explain the long-term viability and future evolution of your solution"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.future}
              onChange={(e) => handleInputChange("future", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Solution Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Be Clear</h4>
                <p className="text-sm text-white/60">
                  Explain your solution in simple terms that anyone can understand.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show, Don't Just Tell</h4>
                <p className="text-sm text-white/60">
                  Include visuals, demos, or examples when presenting your solution.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Focus on Value</h4>
                <p className="text-sm text-white/60">Emphasize the outcomes and benefits, not just features.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Address Objections</h4>
                <p className="text-sm text-white/60">Anticipate and address potential concerns or questions.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function WhyNowSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    historicalContext: "",
    recentTrends: "",
    relevance: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.historicalContext && formData.recentTrends

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Historical context</label>
            <Textarea
              placeholder="What historical factors or developments have led to this moment?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.historicalContext}
              onChange={(e) => handleInputChange("historicalContext", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Recent trends</label>
            <Textarea
              placeholder="What current market, technology, or social trends make your solution timely?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.recentTrends}
              onChange={(e) => handleInputChange("recentTrends", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Relevance of the proposed solution</label>
            <Textarea
              placeholder="Why is now the perfect time for your solution to succeed?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.relevance}
              onChange={(e) => handleInputChange("relevance", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Why Now? Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Identify Inflection Points</h4>
                <p className="text-sm text-white/60">
                  Highlight key technological, regulatory, or market shifts that create your opportunity.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Use Data</h4>
                <p className="text-sm text-white/60">
                  Support your timing argument with market research, adoption curves, or industry forecasts.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Address Past Failures</h4>
                <p className="text-sm text-white/60">
                  If similar ideas failed before, explain what's different now that enables success.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Urgency</h4>
                <p className="text-sm text-white/60">
                  Explain why waiting would mean missing a critical market opportunity.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function MarketPotentialSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    targetCustomers: "",
    customerProfiles: "",
    marketSize: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.targetCustomers && formData.marketSize

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Identify your customer and your market</label>
            <Textarea
              placeholder="Who are your target customers and what market segments are you addressing?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.targetCustomers}
              onChange={(e) => handleInputChange("targetCustomers", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Identification and profiling of target customers</label>
            <Textarea
              placeholder="Describe your ideal customer personas, their needs, behaviors, and pain points"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.customerProfiles}
              onChange={(e) => handleInputChange("customerProfiles", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Calculations of TAM, SAM, and SOM</label>
            <Textarea
              placeholder="Provide detailed market size calculations for Total Addressable Market, Serviceable Available Market, and Serviceable Obtainable Market"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.marketSize}
              onChange={(e) => handleInputChange("marketSize", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Market Potential Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Define TAM, SAM, SOM</h4>
                <p className="text-sm text-white/60">
                  Total Addressable Market, Serviceable Available Market, and Serviceable Obtainable Market.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Use Credible Sources</h4>
                <p className="text-sm text-white/60">Cite reputable market research and industry reports.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Market Trends</h4>
                <p className="text-sm text-white/60">
                  Highlight growth trends and market dynamics that favor your solution.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Be Realistic</h4>
                <p className="text-sm text-white/60">Present ambitious but credible market penetration goals.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function CompetitionSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    directCompetitors: "",
    indirectCompetitors: "",
    winningPlan: "",
    competitiveAdvantages: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.directCompetitors && formData.winningPlan

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Who are your direct competitors?</label>
            <Textarea
              placeholder="List companies that offer similar solutions to the same target market"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.directCompetitors}
              onChange={(e) => handleInputChange("directCompetitors", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Who are your indirect competitors and alternatives?</label>
            <Textarea
              placeholder="Describe other ways customers solve this problem, even if very different from your approach"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.indirectCompetitors}
              onChange={(e) => handleInputChange("indirectCompetitors", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Show that you have a plan to win</label>
            <Textarea
              placeholder="Explain your competitive strategy and how you'll gain market share"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.winningPlan}
              onChange={(e) => handleInputChange("winningPlan", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Highlight the competitive advantages of your solution</label>
            <Textarea
              placeholder="What makes your solution better, faster, cheaper, or more effective than alternatives?"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.competitiveAdvantages}
              onChange={(e) => handleInputChange("competitiveAdvantages", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Competition Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Be Comprehensive</h4>
                <p className="text-sm text-white/60">
                  Don't ignore competitors - investors will know them even if you don't mention them.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Use Comparison Tables</h4>
                <p className="text-sm text-white/60">
                  Create feature/benefit comparison matrices to show your advantages clearly.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Address the Status Quo</h4>
                <p className="text-sm text-white/60">Remember that doing nothing is often your biggest competitor.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Defensibility</h4>
                <p className="text-sm text-white/60">
                  Explain what prevents competitors from simply copying your approach.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ProductOverviewSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    features: "",
    functionalities: "",
    roadmap: "",
    demo: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.features && formData.roadmap

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Detailed description of product features</label>
            <Textarea
              placeholder="List and describe the key features of your product"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.features}
              onChange={(e) => handleInputChange("features", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Product functionalities</label>
            <Textarea
              placeholder="Explain how your product works and what it enables users to do"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.functionalities}
              onChange={(e) => handleInputChange("functionalities", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Future development plans</label>
            <Textarea
              placeholder="Outline your product roadmap and future feature additions"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.roadmap}
              onChange={(e) => handleInputChange("roadmap", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Demo information (if available)</label>
            <Textarea
              placeholder="Provide links or descriptions of any available product demos"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.demo}
              onChange={(e) => handleInputChange("demo", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Product Overview Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Use Visuals</h4>
                <p className="text-sm text-white/60">
                  Include screenshots, diagrams, or mockups to illustrate your product.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Focus on Benefits</h4>
                <p className="text-sm text-white/60">
                  For each feature, explain the specific benefit it provides to users.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Be Realistic</h4>
                <p className="text-sm text-white/60">
                  Present an achievable roadmap with clear milestones and timelines.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Highlight Innovation</h4>
                <p className="text-sm text-white/60">
                  Emphasize what makes your product technically unique or innovative.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function BusinessModelSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    revenueStreams: "",
    pricingStrategies: "",
    customerAcquisition: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.revenueStreams && formData.pricingStrategies

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Outline of revenue streams</label>
            <Textarea
              placeholder="Describe how your business will generate revenue"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.revenueStreams}
              onChange={(e) => handleInputChange("revenueStreams", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Pricing strategies</label>
            <Textarea
              placeholder="Explain your pricing model, tiers, and rationale"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.pricingStrategies}
              onChange={(e) => handleInputChange("pricingStrategies", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Customer acquisition plans</label>
            <Textarea
              placeholder="Describe how you'll acquire and retain customers"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.customerAcquisition}
              onChange={(e) => handleInputChange("customerAcquisition", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Business Model Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Show Unit Economics</h4>
                <p className="text-sm text-white/60">
                  Break down your cost per acquisition, lifetime value, and margins.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Explain Scalability</h4>
                <p className="text-sm text-white/60">Show how your model becomes more profitable as you grow.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Benchmark Competitors</h4>
                <p className="text-sm text-white/60">Compare your pricing to alternatives in the market.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Market Validation</h4>
                <p className="text-sm text-white/60">Provide evidence that customers will pay your prices.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function TeamSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    founders: "",
    management: "",
    board: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.founders

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Profiles of founders</label>
            <Textarea
              placeholder="Introduce the founding team, their backgrounds, and relevant experience"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.founders}
              onChange={(e) => handleInputChange("founders", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Management team</label>
            <Textarea
              placeholder="Describe key executives and their roles in the company"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.management}
              onChange={(e) => handleInputChange("management", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Board members and advisors</label>
            <Textarea
              placeholder="List any board members, advisors, or mentors supporting your company"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.board}
              onChange={(e) => handleInputChange("board", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Team Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Show Domain Expertise</h4>
                <p className="text-sm text-white/60">
                  Highlight experience directly relevant to the problem you're solving.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Demonstrate Complementary Skills</h4>
                <p className="text-sm text-white/60">Show how team members' skills complement each other.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Include Achievements</h4>
                <p className="text-sm text-white/60">
                  Mention notable accomplishments, especially previous exits or successes.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Address Gaps</h4>
                <p className="text-sm text-white/60">Be upfront about skills you're looking to add to the team.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function FinancialOverviewSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    profitLoss: "",
    balanceSheet: "",
    cashFlow: "",
    capTable: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.profitLoss && formData.cashFlow

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Profit & Loss (P&L)</label>
            <Textarea
              placeholder="Summarize your revenue, expenses, and profit/loss projections"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.profitLoss}
              onChange={(e) => handleInputChange("profitLoss", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Balance Sheet</label>
            <Textarea
              placeholder="Provide an overview of your assets, liabilities, and equity"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.balanceSheet}
              onChange={(e) => handleInputChange("balanceSheet", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cash Flow</label>
            <Textarea
              placeholder="Describe your cash flow projections and runway"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.cashFlow}
              onChange={(e) => handleInputChange("cashFlow", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cap Table</label>
            <Textarea
              placeholder="Summarize your capitalization table showing ownership structure"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.capTable}
              onChange={(e) => handleInputChange("capTable", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Financial Overview Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Be Realistic</h4>
                <p className="text-sm text-white/60">
                  Present ambitious but credible financial projections with clear assumptions.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Multiple Scenarios</h4>
                <p className="text-sm text-white/60">
                  Include base case, conservative case, and optimistic case projections.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Highlight Key Metrics</h4>
                <p className="text-sm text-white/60">
                  Focus on the financial metrics most relevant to your business model.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Address Funding Needs</h4>
                <p className="text-sm text-white/60">
                  Clearly explain how much funding you need and how it will be used.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
            onNext()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete & Continue"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function VisionSection({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    vision: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.vision.length > 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">If it all goes right...</label>
            <Textarea
              placeholder="Describe your vision for the company's future and the impact you hope to achieve if everything goes according to plan"
              className="min-h-[200px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.vision}
              onChange={(e) => handleInputChange("vision", e.target.value)}
            />
          </div>
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Vision Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Think Big</h4>
                <p className="text-sm text-white/60">
                  Share your most ambitious vision for what the company could become.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Impact</h4>
                <p className="text-sm text-white/60">
                  Describe the positive change your company will create in the world.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Be Authentic</h4>
                <p className="text-sm text-white/60">
                  Let your genuine passion and conviction shine through in this section.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Connect to Today</h4>
                <p className="text-sm text-white/60">
                  Show how your current work lays the foundation for this future vision.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" className="border-gray-800" disabled>
          <Clock className="mr-2 h-4 w-4" />
          Save Draft
        </Button>

        <Button
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!isFormValid}
          onClick={() => {
            onComplete()
          }}
        >
          {isCompleted ? "Section Completed" : "Complete Section"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
