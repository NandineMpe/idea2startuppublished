"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface Section {
  title: string
  content: string
}

interface Analysis {
  sections: Section[]
}

interface IdeaData {
  ideaDescription: string
  proposedSolution: string
  intendedUsers: string
  geographicFocus: string
}

export default function IdeaAnalyser() {
  const [formData, setFormData] = useState<IdeaData>({
    ideaDescription: "",
    proposedSolution: "",
    intendedUsers: "",
    geographicFocus: "",
  })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [useMockApi, setUseMockApi] = useState(false)
  const { toast } = useToast()

  // Function to format content with paragraphs
  const formatContent = (content: string) => {
    const paragraphs = content.split("\n\n")
    return paragraphs.map((paragraph, index) => (
      <p key={index} className={`mb-${index < paragraphs.length - 1 ? "4" : "0"}`}>
        {paragraph}
      </p>
    ))
  }

  const handleInputChange = (field: keyof IdeaData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAnalyze = async () => {
    if (!formData.ideaDescription.trim()) {
      toast({
        title: "Error",
        description: "Please describe your business idea",
        variant: "destructive",
      })
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysis(null)

    try {
      // Use a timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout

      // Determine which API endpoint to use
      const apiEndpoint = useMockApi ? "/api/mock-idea-analysis" : "/api/openai-idea-analysis"

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Check if the response is ok
      if (!response.ok) {
        // If the OpenAI API fails and we're not already using the mock API, try the mock API
        if (!useMockApi) {
          console.log("OpenAI API failed, falling back to mock API")
          setUseMockApi(true)

          // Try again with the mock API
          const mockResponse = await fetch("/api/mock-idea-analysis", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          })

          if (!mockResponse.ok) {
            const responseText = await mockResponse.text()
            console.error("Mock API error response:", responseText)
            throw new Error(
              `Both APIs failed. Mock API returned ${mockResponse.status}: ${responseText.substring(0, 100)}...`,
            )
          }

          const data = await mockResponse.json()

          if (data.error) {
            throw new Error(data.error)
          }

          setAnalysis(data.analysis)
          toast({
            title: "Analysis Complete (Using Mock Data)",
            description: "Your business idea has been analyzed using our offline analysis engine.",
          })
          setIsAnalyzing(false)
          return
        }

        // If we're already using the mock API and it failed, show the error
        const responseText = await response.text()
        console.error("Error response:", responseText)
        throw new Error(`Server returned ${response.status}: ${responseText.substring(0, 100)}...`)
      }

      // Try to parse the JSON response
      let data
      try {
        data = await response.json()
      } catch (jsonError) {
        // If JSON parsing fails, get the raw text
        const responseText = await response.text()
        console.error("Invalid JSON response:", responseText)
        throw new Error(`Server returned invalid JSON. Response: ${responseText.substring(0, 100)}...`)
      }

      // Check if there's an error in the response
      if (data.error) {
        throw new Error(data.error)
      }

      setAnalysis(data.analysis)
      toast({
        title: "Analysis Complete",
        description: useMockApi
          ? "Your business idea has been analyzed using our offline analysis engine."
          : "Your business idea has been analyzed successfully.",
      })
    } catch (err) {
      console.error("Error analyzing idea:", err)
      setError(err instanceof Error ? err.message : "An unknown error occurred")
      toast({
        title: "Analysis Failed",
        description: err instanceof Error ? err.message : "An unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Business Idea Analyzer</CardTitle>
          <CardDescription>Describe your business idea and get a comprehensive analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ideaDescription">What idea are you thinking about?</Label>
            <Textarea
              id="ideaDescription"
              placeholder="Describe your business idea in detail..."
              value={formData.ideaDescription}
              onChange={(e) => handleInputChange("ideaDescription", e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposedSolution">What solution are you thinking of?</Label>
            <Textarea
              id="proposedSolution"
              placeholder="Describe your proposed solution..."
              value={formData.proposedSolution}
              onChange={(e) => handleInputChange("proposedSolution", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="intendedUsers">Who is it for?</Label>
            <Textarea
              id="intendedUsers"
              placeholder="Describe your target users or customers..."
              value={formData.intendedUsers}
              onChange={(e) => handleInputChange("intendedUsers", e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="geographicFocus">Where is it for?</Label>
            <Textarea
              id="geographicFocus"
              placeholder="Describe the geographic focus or market..."
              value={formData.geographicFocus}
              onChange={(e) => handleInputChange("geographicFocus", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2 pt-4">
            <Switch id="use-mock-api" checked={useMockApi} onCheckedChange={setUseMockApi} />
            <Label htmlFor="use-mock-api" className="cursor-pointer">
              Use offline analysis (faster but less detailed)
            </Label>
          </div>

          <Button onClick={handleAnalyze} disabled={isAnalyzing || !formData.ideaDescription.trim()} className="w-full">
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing (this may take a few minutes)...
              </>
            ) : (
              "Analyze Business Idea"
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <p className="mt-4">Please try again or enable offline analysis if the issue persists.</p>
          </CardContent>
        </Card>
      )}

      {analysis && analysis.sections && analysis.sections.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Business Idea Analysis</h2>

          {analysis.sections.map((section, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader className="bg-slate-50">
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">{formatContent(section.content)}</CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
