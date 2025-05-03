"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Loader2,
  Lightbulb,
  BarChart3,
  Target,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Users,
  MapPin,
} from "lucide-react"
import { CollapsibleSection } from "@/components/visualizations/collapsible-section"
import { getBusinessIdea, saveBusinessIdea } from "@/app/actions/user-data"
import { useSectionTracker } from "@/hooks/use-section-tracker"

interface AnalysisSection {
  title: string
  content: string
  score?: number
}

interface AnalysisResponse {
  sections: AnalysisSection[]
}

interface BusinessIdeaForm {
  problem: string
  solution: string
  audience?: string
  location?: string
}

export default function BusinessIdeaAnalysisPage() {
  const [formData, setFormData] = useState<BusinessIdeaForm>({
    problem: "",
    solution: "",
    audience: "",
    location: "",
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Track this section visit
  const { completeSection } = useSectionTracker("business-idea-analyzer", { markInProgress: true })

  // Load saved business idea data when component mounts
  useEffect(() => {
    const loadBusinessIdea = async () => {
      try {
        setIsLoading(true)
        const savedIdea = await getBusinessIdea()

        if (savedIdea) {
          setFormData({
            problem: savedIdea.problem || "",
            solution: savedIdea.solution || "",
            audience: savedIdea.audience || "",
            location: savedIdea.location || "",
          })

          if (savedIdea.analysis) {
            setAnalysis(savedIdea.analysis)
          }
        }
      } catch (error) {
        console.error("Error loading business idea:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadBusinessIdea()
  }, [])

  // Debounced save function
  useEffect(() => {
    const saveTimeout = setTimeout(async () => {
      if (formData.problem || formData.solution || formData.audience || formData.location) {
        setIsSaving(true)
        try {
          await saveBusinessIdea({
            ...formData,
            analysis: analysis,
          })
        } catch (error) {
          console.error("Error auto-saving business idea:", error)
        } finally {
          setIsSaving(false)
        }
      }
    }, 1000) // 1 second debounce

    return () => clearTimeout(saveTimeout)
  }, [formData, analysis])

  const handleInputChange =
    (field: keyof BusinessIdeaForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const updatedFormData = { ...formData, [field]: e.target.value }
      setFormData(updatedFormData)
    }

  const handleAnalyze = async () => {
    // Validate required fields
    if (!formData.problem.trim()) {
      setError("Please describe the problem you're looking to solve")
      return
    }

    if (!formData.solution.trim()) {
      setError("Please describe your proposed solution")
      return
    }

    try {
      setIsAnalyzing(true)
      setError(null)

      // Format the business idea from the form fields
      const businessIdea = `
Problem: ${formData.problem}
Solution: ${formData.solution}
${formData.audience ? `Target Audience: ${formData.audience}` : ""}
${formData.location ? `Location/Market: ${formData.location}` : ""}
      `.trim()

      const response = await fetch("/api/analyze-business-idea", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ businessIdea }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze business idea")
      }

      const data = await response.json()
      setAnalysis(data.analysis)

      // Save the analysis result
      await saveBusinessIdea({
        problem: formData.problem,
        solution: formData.solution,
        audience: formData.audience,
        location: formData.location,
        analysis: data.analysis,
      })

      // Mark this section as completed
      await completeSection()
    } catch (err) {
      console.error("Error analyzing business idea:", err)
      setError("Failed to analyze your business idea. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const getSectionIcon = (title: string) => {
    if (title.includes("PROBLEM") || title.includes("HYPOTHESIS")) return <Lightbulb className="h-5 w-5" />
    if (title.includes("MARKET") || title.includes("DEMAND")) return <BarChart3 className="h-5 w-5" />
    if (title.includes("BENEFITS") || title.includes("GAPS") || title.includes("PROPOSITION"))
      return <Target className="h-5 w-5" />
    if (title.includes("MONETIZATION") || title.includes("LOGIC") || title.includes("BUSINESS MODEL"))
      return <DollarSign className="h-5 w-5" />
    if (title.includes("RISK") || title.includes("BARRIER")) return <AlertTriangle className="h-5 w-5" />
    if (title.includes("RECOMMENDATIONS") || title.includes("OPPORTUNITY")) return <CheckCircle2 className="h-5 w-5" />
    return <Lightbulb className="h-5 w-5" />
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-white">Loading your business idea...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Business Idea Analyzer</h1>
        <p className="text-white/60">Get a comprehensive analysis of your business idea from multiple perspectives</p>
        {isSaving && <p className="text-xs text-primary/70">Saving your changes...</p>}
      </div>

      <Card className="glass-card border-primary/10">
        <CardHeader>
          <CardTitle className="text-white">Describe Your Business Idea</CardTitle>
          <CardDescription className="text-white/60">
            Fill out the form below to analyze your business idea
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="problem" className="text-white">
              What is the problem you are looking to solve? <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="problem"
              placeholder="Describe the problem in detail..."
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary text-white"
              value={formData.problem}
              onChange={handleInputChange("problem")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="solution" className="text-white">
              What solution do you propose? <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="solution"
              placeholder="Describe your solution in detail..."
              className="min-h-[100px] bg-black/50 border-gray-800 focus:border-primary text-white"
              value={formData.solution}
              onChange={handleInputChange("solution")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audience" className="text-white flex items-center gap-2">
                <Users className="h-4 w-4" /> Who are you building this for?{" "}
                <span className="text-white/60 text-sm">(Optional)</span>
              </Label>
              <Input
                id="audience"
                placeholder="Target audience, customer segments..."
                className="bg-black/50 border-gray-800 focus:border-primary text-white"
                value={formData.audience}
                onChange={handleInputChange("audience")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-white flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Where are you building this for?{" "}
                <span className="text-white/60 text-sm">(Optional)</span>
              </Label>
              <Input
                id="location"
                placeholder="Geographic region, market..."
                className="bg-black/50 border-gray-800 focus:border-primary text-white"
                value={formData.location}
                onChange={handleInputChange("location")}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end">
            <Button
              className="bg-primary hover:bg-primary/90 text-black"
              onClick={handleAnalyze}
              disabled={isAnalyzing || !formData.problem.trim() || !formData.solution.trim()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Idea"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAnalyzing && (
        <Card className="glass-card border-primary/10 p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Analyzing Your Business Idea</h3>
            <p className="text-white/60 text-center max-w-md">
              Our AI is thoroughly evaluating your business idea from multiple perspectives. This may take a minute...
            </p>
          </div>
        </Card>
      )}

      {analysis && !isAnalyzing && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Analysis Results</h2>
          {analysis.sections.map((section, index) => (
            <Card key={index} className="glass-card border-primary/10">
              <CollapsibleSection
                title={
                  <div className="flex items-center gap-2">
                    {getSectionIcon(section.title)}
                    <span>{section.title}</span>
                  </div>
                }
                defaultOpen={index === 0}
              >
                <div className="whitespace-pre-line text-white/80">{section.content}</div>
              </CollapsibleSection>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
