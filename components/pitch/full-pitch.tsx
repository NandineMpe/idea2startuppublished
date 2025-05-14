"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Download,
  FileText,
  Users,
  TrendingUp,
  DollarSign,
  BarChart,
  Target,
  Lightbulb,
  Clock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function FullPitch() {
  const [activeSection, setActiveSection] = useState("problem")
  const [progress, setProgress] = useState(0)
  const [completedSections, setCompletedSections] = useState<string[]>([])
  const { toast } = useToast()

  const sections = [
    { id: "problem", title: "Problem", icon: <Lightbulb className="h-5 w-5" /> },
    { id: "solution", title: "Solution", icon: <Target className="h-5 w-5" /> },
    { id: "market", title: "Market", icon: <BarChart className="h-5 w-5" /> },
    { id: "business-model", title: "Business Model", icon: <DollarSign className="h-5 w-5" /> },
    { id: "traction", title: "Traction", icon: <TrendingUp className="h-5 w-5" /> },
    { id: "team", title: "Team", icon: <Users className="h-5 w-5" /> },
    { id: "ask", title: "The Ask", icon: <FileText className="h-5 w-5" /> },
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

            <TabsContent value="market" className="mt-0">
              <MarketSection
                onComplete={() => handleSectionComplete("market")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("market")}
              />
            </TabsContent>

            <TabsContent value="business-model" className="mt-0">
              <BusinessModelSection
                onComplete={() => handleSectionComplete("business-model")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("business-model")}
              />
            </TabsContent>

            <TabsContent value="traction" className="mt-0">
              <TractionSection
                onComplete={() => handleSectionComplete("traction")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("traction")}
              />
            </TabsContent>

            <TabsContent value="team" className="mt-0">
              <TeamSection
                onComplete={() => handleSectionComplete("team")}
                onNext={handleNextSection}
                isCompleted={completedSections.includes("team")}
              />
            </TabsContent>

            <TabsContent value="ask" className="mt-0">
              <AskSection
                onComplete={() => handleSectionComplete("ask")}
                isCompleted={completedSections.includes("ask")}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {progress === 100 && (
        <Card className="glass-card border-primary/10">
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

// Section Components with AI generation
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
    problem: "",
    impact: "",
    currentSolutions: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.problem && formData.impact

  const generateContent = async () => {
    if (!formData.problem) {
      toast({
        title: "Missing information",
        description: "Please describe the problem your startup is solving",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "problem",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        problem: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your problem section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">What problem are you solving?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Describe the specific problem or pain point your startup addresses"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.problem}
              onChange={(e) => handleInputChange("problem", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What's the impact of this problem?</label>
            <Textarea
              placeholder="Explain the consequences of this problem (financial, emotional, operational, etc.)"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.impact}
              onChange={(e) => handleInputChange("impact", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">How are people solving this today? (Optional)</label>
            <Textarea
              placeholder="Describe current alternatives or workarounds and their limitations"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.currentSolutions}
              onChange={(e) => handleInputChange("currentSolutions", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
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
          disabled={!isFormValid || isGenerating}
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
    solution: "",
    uniqueness: "",
    benefits: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.solution && formData.uniqueness

  const generateContent = async () => {
    if (!formData.uniqueness) {
      toast({
        title: "Missing information",
        description: "Please describe what makes your solution unique",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "solution",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        solution: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your solution section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">What's your solution?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Describe your product or service and how it works"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.solution}
              onChange={(e) => handleInputChange("solution", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What makes your solution unique?</label>
            <Textarea
              placeholder="Explain your competitive advantage or unique approach"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.uniqueness}
              onChange={(e) => handleInputChange("uniqueness", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What are the key benefits?</label>
            <Textarea
              placeholder="List the main benefits and outcomes for your customers"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.benefits}
              onChange={(e) => handleInputChange("benefits", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
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
          disabled={!isFormValid || isGenerating}
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

function MarketSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    targetMarket: "",
    marketSize: "",
    competition: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.targetMarket && formData.marketSize

  const generateContent = async () => {
    if (!formData.targetMarket) {
      toast({
        title: "Missing information",
        description: "Please describe your target market",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "market",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        marketSize: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your market section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Who is your target market?</label>
            <Textarea
              placeholder="Describe your ideal customers and their characteristics"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.targetMarket}
              onChange={(e) => handleInputChange("targetMarket", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">What's the market size and opportunity?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Quantify your TAM, SAM, and SOM with relevant data"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.marketSize}
              onChange={(e) => handleInputChange("marketSize", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Who are your competitors?</label>
            <Textarea
              placeholder="List direct and indirect competitors and how you differ"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.competition}
              onChange={(e) => handleInputChange("competition", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Market Section Tips</CardTitle>
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
          disabled={!isFormValid || isGenerating}
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
    revenueModel: "",
    pricing: "",
    channels: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.revenueModel && formData.pricing

  const generateContent = async () => {
    if (!formData.pricing) {
      toast({
        title: "Missing information",
        description: "Please describe your pricing strategy",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "business-model",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        revenueModel: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your business model section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">What's your revenue model?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Describe how you make money (subscription, one-time purchase, etc.)"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.revenueModel}
              onChange={(e) => handleInputChange("revenueModel", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What's your pricing strategy?</label>
            <Textarea
              placeholder="Explain your pricing tiers, structure, and rationale"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.pricing}
              onChange={(e) => handleInputChange("pricing", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What are your distribution channels?</label>
            <Textarea
              placeholder="Describe how you'll reach and acquire customers"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.channels}
              onChange={(e) => handleInputChange("channels", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
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
          disabled={!isFormValid || isGenerating}
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

function TractionSection({
  onComplete,
  onNext,
  isCompleted,
}: {
  onComplete: () => void
  onNext: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    currentTraction: "",
    milestones: "",
    metrics: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.currentTraction

  const generateContent = async () => {
    if (!formData.milestones) {
      toast({
        title: "Missing information",
        description: "Please describe your key milestones",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "traction",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        currentTraction: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your traction section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">What traction do you have so far?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Describe your current users, customers, or partnerships"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.currentTraction}
              onChange={(e) => handleInputChange("currentTraction", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What milestones have you achieved?</label>
            <Textarea
              placeholder="List key achievements and their timing"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.milestones}
              onChange={(e) => handleInputChange("milestones", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What are your key metrics?</label>
            <Textarea
              placeholder="Share growth rates, engagement stats, or other relevant metrics"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.metrics}
              onChange={(e) => handleInputChange("metrics", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Traction Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Show Growth</h4>
                <p className="text-sm text-white/60">Highlight growth rates and trends, not just absolute numbers.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Use Visuals</h4>
                <p className="text-sm text-white/60">Include charts or graphs to illustrate your traction.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Focus on Key Metrics</h4>
                <p className="text-sm text-white/60">Emphasize the metrics that matter most for your business model.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Include Social Proof</h4>
                <p className="text-sm text-white/60">Add testimonials or case studies from early customers.</p>
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
          disabled={!isFormValid || isGenerating}
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
    expertise: "",
    advisors: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.founders && formData.expertise

  const generateContent = async () => {
    if (!formData.expertise) {
      toast({
        title: "Missing information",
        description: "Please describe your team's expertise",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "team",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        founders: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your team section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Who are the founders?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Introduce the founding team and their backgrounds"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.founders}
              onChange={(e) => handleInputChange("founders", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What relevant expertise does your team have?</label>
            <Textarea
              placeholder="Highlight experience and skills relevant to this venture"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.expertise}
              onChange={(e) => handleInputChange("expertise", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Do you have advisors or mentors? (Optional)</label>
            <Textarea
              placeholder="List any notable advisors, mentors, or board members"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.advisors}
              onChange={(e) => handleInputChange("advisors", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
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
          disabled={!isFormValid || isGenerating}
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

function AskSection({
  onComplete,
  isCompleted,
}: {
  onComplete: () => void
  isCompleted: boolean
}) {
  const [formData, setFormData] = useState({
    funding: "",
    use: "",
    timeline: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid = formData.funding && formData.use

  const generateContent = async () => {
    if (!formData.use) {
      toast({
        title: "Missing information",
        description: "Please describe how you'll use the funds",
        variant: "destructive",
      })
      return
    }

    setIsGenerating(true)
    setGenerationError(null)

    try {
      const response = await fetch("/api/generate-pitch-slide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slideType: "ask",
          slideData: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate content")
      }

      const data = await response.json()

      // Update the form with the generated content
      setFormData((prev) => ({
        ...prev,
        funding: data.content,
      }))

      toast({
        title: "Content generated",
        description: "AI-generated content has been added to your ask section",
      })
    } catch (error) {
      console.error("Error generating content:", error)
      setGenerationError(error instanceof Error ? error.message : "Unknown error occurred")
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">How much funding are you seeking?</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/30 text-primary"
                onClick={generateContent}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>Generating...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Specify the amount and type of funding (equity, debt, etc.)"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.funding}
              onChange={(e) => handleInputChange("funding", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">How will you use the funds?</label>
            <Textarea
              placeholder="Break down how the investment will be allocated"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.use}
              onChange={(e) => handleInputChange("use", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">What's your timeline and key milestones?</label>
            <Textarea
              placeholder="Outline your roadmap and what you'll achieve with this funding"
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary"
              value={formData.timeline}
              onChange={(e) => handleInputChange("timeline", e.target.value)}
            />
          </div>

          {generationError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-200">{generationError}</p>
            </div>
          )}
        </div>

        <div>
          <Card className="glass-card border-primary/10 h-full">
            <CardHeader>
              <CardTitle className="text-primary">Ask Section Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Be Specific</h4>
                <p className="text-sm text-white/60">State exactly how much you're raising and at what valuation.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Show Runway</h4>
                <p className="text-sm text-white/60">
                  Explain how long the funding will last and what it will help you achieve.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Justify the Amount</h4>
                <p className="text-sm text-white/60">Explain why you need this specific amount, not more or less.</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Include Exit Strategy</h4>
                <p className="text-sm text-white/60">
                  Share your vision for potential acquisition targets or IPO timeline.
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
          disabled={!isFormValid || isGenerating}
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
