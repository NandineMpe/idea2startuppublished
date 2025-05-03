"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Copy, CheckCircle2, RefreshCw, Download, DollarSign, Users, MessageSquare, Zap } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ElevatorPitch() {
  const [activeTab, setActiveTab] = useState("investor")

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/10">
        <CardHeader>
          <CardTitle>Choose Your Audience</CardTitle>
          <CardDescription>
            Tailor your elevator pitch to the specific audience you're targeting for maximum impact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-black/50 rounded-lg h-auto p-1 border border-gray-800">
              <TabsTrigger
                value="investor"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md flex items-center gap-2"
              >
                <DollarSign className="h-4 w-4" />
                Investor Pitch
              </TabsTrigger>
              <TabsTrigger
                value="customer"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Customer Pitch
              </TabsTrigger>
              <TabsTrigger
                value="networking"
                className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Networking Pitch
              </TabsTrigger>
            </TabsList>

            <TabsContent value="investor" className="mt-6">
              <InvestorElevatorPitch />
            </TabsContent>

            <TabsContent value="customer" className="mt-6">
              <CustomerElevatorPitch />
            </TabsContent>

            <TabsContent value="networking" className="mt-6">
              <NetworkingElevatorPitch />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function InvestorElevatorPitch() {
  const [businessIdea, setBusinessIdea] = useState("")
  const [selectedProject, setSelectedProject] = useState("")
  const [generatedPitch, setGeneratedPitch] = useState<{
    elevatorPitch: string
    punchlines: string[]
    summary: {
      problem: string
      solution: string
      targetMarket: string
      differentiator: string
      traction: string
      ask: string
    }
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sample projects - in a real app, these would come from your database
  const sampleProjects = [
    { id: "project1", name: "AI-Powered Content Creation Platform" },
    { id: "project2", name: "Sustainable Fashion Marketplace" },
    { id: "project3", name: "Remote Team Collaboration Tool" },
    { id: "project4", name: "Health & Wellness Subscription Service" },
    { id: "project5", name: "Smart Home Energy Management System" },
  ]

  const handleGeneratePitch = async () => {
    try {
      setIsGenerating(true)
      setError(null)

      // Prepare the request payload
      const payload = {
        businessIdea: businessIdea.trim(),
        projectId: selectedProject || undefined,
      }

      const response = await fetch("/api/generate-investor-pitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate pitch")
      }

      const data = await response.json()
      setGeneratedPitch(data.pitch)
    } catch (error: any) {
      console.error("Error generating pitch:", error)
      setError(error.message || "Failed to generate pitch. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!generatedPitch) return

    navigator.clipboard.writeText(generatedPitch.elevatorPitch)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setBusinessIdea("")
    setSelectedProject("")
    setGeneratedPitch(null)
    setError(null)
  }

  const isFormValid = businessIdea.trim().length > 0 || selectedProject.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="glass-card border-primary/10">
          <CardHeader>
            <CardTitle>Craft Your Investor Elevator Pitch</CardTitle>
            <CardDescription>
              Describe your startup idea or select an existing project to generate a compelling investor pitch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select an existing project (optional)</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-black/50 border-gray-800 focus:border-primary text-white">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="none">None</SelectItem>
                  {sampleProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="hover:bg-primary/20 hover:text-primary">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Describe your startup idea <span className="text-primary">*</span>
              </label>
              <Textarea
                placeholder="Briefly describe your startup idea, product, or service"
                className="min-h-[120px] bg-black/50 border-gray-800 focus:border-primary text-white"
                value={businessIdea}
                onChange={(e) => setBusinessIdea(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                You can either select a project from the dropdown or describe your idea. Our AI will fill in the details
                to create a compelling pitch.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" className="border-gray-800" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-black"
              onClick={handleGeneratePitch}
              disabled={isGenerating || !isFormValid}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Investor Pitch"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <Card className="glass-card border-primary/10 h-full">
          <CardHeader>
            <CardTitle>Your Investor Elevator Pitch</CardTitle>
            <CardDescription>
              {generatedPitch
                ? "Here's your data-driven investor pitch"
                : "Fill out the form and generate your investor pitch"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4 text-red-400">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {generatedPitch ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-lg bg-black/50 border-gray-800 border p-4">
                  <h3 className="mb-2 text-lg font-semibold text-primary">Investor Pitch</h3>
                  <div className="whitespace-pre-line text-sm">{generatedPitch.elevatorPitch}</div>
                </div>

                {generatedPitch.summary && (
                  <div className="rounded-lg bg-black/50 border-gray-800 border p-4">
                    <h3 className="mb-2 text-lg font-semibold text-primary">Summary</h3>
                    <ul className="space-y-2 text-sm">
                      {generatedPitch.summary.problem && (
                        <li>
                          <span className="font-medium">Problem:</span> {generatedPitch.summary.problem}
                        </li>
                      )}
                      {generatedPitch.summary.solution && (
                        <li>
                          <span className="font-medium">Solution:</span> {generatedPitch.summary.solution}
                        </li>
                      )}
                      {generatedPitch.summary.targetMarket && (
                        <li>
                          <span className="font-medium">Target Market:</span> {generatedPitch.summary.targetMarket}
                        </li>
                      )}
                      {generatedPitch.summary.differentiator && (
                        <li>
                          <span className="font-medium">Differentiator:</span> {generatedPitch.summary.differentiator}
                        </li>
                      )}
                      {generatedPitch.summary.traction && (
                        <li>
                          <span className="font-medium">Traction:</span> {generatedPitch.summary.traction}
                        </li>
                      )}
                      {generatedPitch.summary.ask && (
                        <li>
                          <span className="font-medium">Ask:</span> {generatedPitch.summary.ask}
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {generatedPitch.punchlines && generatedPitch.punchlines.length > 0 && (
                  <div className="rounded-lg bg-black/50 border-gray-800 border p-4">
                    <h3 className="mb-2 text-lg font-semibold text-primary">Punchlines</h3>
                    <ul className="space-y-3">
                      {generatedPitch.punchlines.map((punchline, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <span className="italic">{punchline}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black/50 border border-gray-800 rounded-lg p-6 min-h-[300px] flex items-center justify-center text-gray-500">
                <p className="text-center">
                  {isGenerating ? "Generating your investor pitch..." : "Your investor elevator pitch will appear here"}
                </p>
              </div>
            )}
          </CardContent>
          {generatedPitch && (
            <CardFooter className="flex justify-between">
              <Button variant="outline" className="border-gray-800" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-black">
                <Download className="mr-2 h-4 w-4" />
                Save Pitch
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}

function CustomerElevatorPitch() {
  const [businessIdea, setBusinessIdea] = useState("")
  const [selectedProject, setSelectedProject] = useState("")
  const [generatedPitch, setGeneratedPitch] = useState<{
    headline: string
    painPoint: string
    solution: string
    outcome: string
    socialProof: string
    cta: string
    hooks: string[]
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sample projects - in a real app, these would come from your database
  const sampleProjects = [
    { id: "project1", name: "AI-Powered Content Creation Platform" },
    { id: "project2", name: "Sustainable Fashion Marketplace" },
    { id: "project3", name: "Remote Team Collaboration Tool" },
    { id: "project4", name: "Health & Wellness Subscription Service" },
    { id: "project5", name: "Smart Home Energy Management System" },
  ]

  const handleGeneratePitch = async () => {
    try {
      setIsGenerating(true)
      setError(null)

      // Prepare the request payload
      const payload = {
        businessIdea: businessIdea.trim(),
        projectId: selectedProject || undefined,
      }

      const response = await fetch("/api/generate-customer-pitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate pitch")
      }

      const data = await response.json()
      setGeneratedPitch(data.pitch)
    } catch (error: any) {
      console.error("Error generating pitch:", error)
      setError(error.message || "Failed to generate pitch. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!generatedPitch) return

    // Combine all parts of the pitch into a single string for copying
    const fullPitch = `
${generatedPitch.headline}

${generatedPitch.painPoint}

${generatedPitch.solution}

${generatedPitch.outcome}

${generatedPitch.socialProof}

${generatedPitch.cta}
`.trim()

    navigator.clipboard.writeText(fullPitch)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setBusinessIdea("")
    setSelectedProject("")
    setGeneratedPitch(null)
    setError(null)
  }

  const isFormValid = businessIdea.trim().length > 0 || selectedProject.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="glass-card border-primary/10">
          <CardHeader>
            <CardTitle>Craft Your Customer Elevator Pitch</CardTitle>
            <CardDescription>
              Create a compelling customer-facing pitch that creates emotional urgency and positions your product as the
              solution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select an existing project (optional)</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-black/50 border-gray-800 focus:border-primary text-white">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="none">None</SelectItem>
                  {sampleProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="hover:bg-primary/20 hover:text-primary">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Describe your product or service <span className="text-primary">*</span>
              </label>
              <Textarea
                placeholder="Briefly describe your product, the problem it solves, and who it's for"
                className="min-h-[120px] bg-black/50 border-gray-800 focus:border-primary text-white"
                value={businessIdea}
                onChange={(e) => setBusinessIdea(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                You can either select a project from the dropdown or describe your idea. Our AI will craft a compelling
                customer pitch that creates urgency and builds trust.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" className="border-gray-800" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-black"
              onClick={handleGeneratePitch}
              disabled={isGenerating || !isFormValid}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Customer Pitch"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <Card className="glass-card border-primary/10 h-full">
          <CardHeader>
            <CardTitle>Your Customer Elevator Pitch</CardTitle>
            <CardDescription>
              {generatedPitch
                ? "Here's your customer-focused pitch"
                : "Fill out the form and generate your customer pitch"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4 text-red-400">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {generatedPitch ? (
              <div className="space-y-6">
                {generatedPitch.headline && (
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-2 text-primary">{generatedPitch.headline}</h3>
                    {generatedPitch.painPoint && <p className="text-base mb-4">{generatedPitch.painPoint}</p>}
                    {generatedPitch.solution && <p className="text-base mb-4">{generatedPitch.solution}</p>}
                    {generatedPitch.outcome && <p className="text-base mb-4">{generatedPitch.outcome}</p>}
                    {generatedPitch.socialProof && (
                      <p className="text-base mb-4 text-gray-300">{generatedPitch.socialProof}</p>
                    )}
                    {generatedPitch.cta && (
                      <div className="flex items-center gap-2 bg-primary/10 p-3 rounded-md border border-primary/30 mt-4">
                        <Zap className="h-5 w-5 text-primary" />
                        <p className="font-medium">{generatedPitch.cta}</p>
                      </div>
                    )}
                  </div>
                )}

                {generatedPitch.hooks && generatedPitch.hooks.length > 0 && (
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-primary">Alternative Headlines</h3>
                    <ul className="space-y-3">
                      {generatedPitch.hooks.map((hook, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary font-bold">•</span>
                          <span className="italic">{hook}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-black/50 border border-gray-800 rounded-lg p-6 min-h-[300px] flex items-center justify-center text-gray-500">
                <p className="text-center">
                  {isGenerating ? "Generating your customer pitch..." : "Your customer elevator pitch will appear here"}
                </p>
              </div>
            )}
          </CardContent>
          {generatedPitch && (
            <CardFooter className="flex justify-between">
              <Button variant="outline" className="border-gray-800" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-black">
                <Download className="mr-2 h-4 w-4" />
                Save Pitch
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}

function NetworkingElevatorPitch() {
  const [businessIdea, setBusinessIdea] = useState("")
  const [personalBackground, setPersonalBackground] = useState("")
  const [goals, setGoals] = useState("")
  const [generatedPitch, setGeneratedPitch] = useState<{
    networkingPitch: string
    sections?: {
      hook: string
      problem: string
      solution: string
      personal: string
      invitation: string
    }
    conversationStarters: string[]
    followUpQuestion: string
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sample projects - in a real app, these would come from your database
  const sampleProjects = [
    { id: "project1", name: "AI-Powered Content Creation Platform" },
    { id: "project2", name: "Sustainable Fashion Marketplace" },
    { id: "project3", name: "Remote Team Collaboration Tool" },
    { id: "project4", name: "Health & Wellness Subscription Service" },
    { id: "project5", name: "Smart Home Energy Management System" },
  ]

  const [selectedProject, setSelectedProject] = useState("")

  const handleGeneratePitch = async () => {
    try {
      setIsGenerating(true)
      setError(null)

      // Prepare the request payload
      const payload = {
        businessIdea:
          businessIdea.trim() || (selectedProject ? sampleProjects.find((p) => p.id === selectedProject)?.name : ""),
        personalBackground: personalBackground.trim(),
        goals: goals.trim(),
      }

      const response = await fetch("/api/generate-networking-pitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate pitch")
      }

      const data = await response.json()
      setGeneratedPitch(data.pitch)
    } catch (error: any) {
      console.error("Error generating pitch:", error)
      setError(error.message || "Failed to generate pitch. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (!generatedPitch) return

    navigator.clipboard.writeText(generatedPitch.networkingPitch)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleNetworkingReset = () => {
    setBusinessIdea("")
    setPersonalBackground("")
    setGoals("")
    setSelectedProject("")
    setGeneratedPitch(null)
    setError(null)
  }

  const isFormValid = businessIdea.trim().length > 0 || selectedProject.length > 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="glass-card border-primary/10">
          <CardHeader>
            <CardTitle>Craft Your Networking Elevator Pitch</CardTitle>
            <CardDescription>
              A networking pitch should sound natural and conversational. It's about making a genuine connection, not
              delivering a sales presentation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select an existing project (optional)</label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-black/50 border-gray-800 focus:border-primary text-white">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  <SelectItem value="none">None</SelectItem>
                  {sampleProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="hover:bg-primary/20 hover:text-primary">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Describe your business idea <span className="text-primary">*</span>
              </label>
              <Textarea
                placeholder="Briefly describe your startup or product in simple terms"
                className="min-h-[80px] bg-black/50 border-gray-800 focus:border-primary text-white"
                value={businessIdea}
                onChange={(e) => setBusinessIdea(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your background (optional)</label>
              <Textarea
                placeholder="Share a bit about your background, experience, or why you started this"
                className="min-h-[80px] bg-black/50 border-gray-800 focus:border-primary text-white"
                value={personalBackground}
                onChange={(e) => setPersonalBackground(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Networking goals (optional)</label>
              <Textarea
                placeholder="What are you hoping to achieve with this pitch? Finding partners, customers, investors?"
                className="min-h-[80px] bg-black/50 border-gray-800 focus:border-primary text-white"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" className="border-gray-800" onClick={handleNetworkingReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-black"
              onClick={handleGeneratePitch}
              disabled={isGenerating || !isFormValid}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Networking Pitch"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div>
        <Card className="glass-card border-primary/10 h-full">
          <CardHeader>
            <CardTitle>Your Networking Elevator Pitch</CardTitle>
            <CardDescription>
              {generatedPitch
                ? "Here's your conversational networking pitch"
                : "Fill out the form and generate your networking pitch"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4 text-red-400">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {generatedPitch ? (
              <div className="space-y-6">
                <div className="bg-black/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">Your Pitch</h3>
                  <p className="text-lg leading-relaxed whitespace-pre-line">{generatedPitch.networkingPitch}</p>
                </div>

                {generatedPitch.sections && (
                  <div className="bg-black/50 border border-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold mb-3 text-primary">Pitch Structure</h3>
                    <div className="space-y-3">
                      {generatedPitch.sections.hook && (
                        <div>
                          <h4 className="font-medium text-primary">Hook</h4>
                          <p className="text-sm">{generatedPitch.sections.hook}</p>
                        </div>
                      )}
                      {generatedPitch.sections.problem && (
                        <div>
                          <h4 className="font-medium text-primary">Problem</h4>
                          <p className="text-sm">{generatedPitch.sections.problem}</p>
                        </div>
                      )}
                      {generatedPitch.sections.solution && (
                        <div>
                          <h4 className="font-medium text-primary">Solution</h4>
                          <p className="text-sm">{generatedPitch.sections.solution}</p>
                        </div>
                      )}
                      {generatedPitch.sections.personal && (
                        <div>
                          <h4 className="font-medium text-primary">Personal Connection</h4>
                          <p className="text-sm">{generatedPitch.sections.personal}</p>
                        </div>
                      )}
                      {generatedPitch.sections.invitation && (
                        <div>
                          <h4 className="font-medium text-primary">Invitation</h4>
                          <p className="text-sm">{generatedPitch.sections.invitation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-black/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">Conversation Starters</h3>
                  <ul className="space-y-3">
                    {generatedPitch.conversationStarters.map((starter, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary font-bold">•</span>
                        <span>{starter}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-black/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-3 text-primary">Follow-Up Question</h3>
                  <div className="flex items-center gap-2 bg-primary/10 p-3 rounded-md border border-primary/30">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <p className="font-medium italic">"{generatedPitch.followUpQuestion}"</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-black/50 border border-gray-800 rounded-lg p-6 min-h-[300px] flex items-center justify-center text-gray-500">
                <p className="text-center">
                  {isGenerating
                    ? "Generating your networking pitch..."
                    : "Your networking elevator pitch will appear here"}
                </p>
              </div>
            )}
          </CardContent>
          {generatedPitch && (
            <CardFooter className="flex justify-between">
              <Button variant="outline" className="border-gray-800" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-primary" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-black">
                <Download className="mr-2 h-4 w-4" />
                Save Pitch
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
