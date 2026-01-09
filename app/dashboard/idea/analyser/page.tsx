"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Lightbulb, Target, Users, Globe, Sparkles, CheckCircle2, AlertCircle } from "lucide-react"
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

  const handleInputChange = (field: keyof IdeaData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAnalyze = async () => {
    if (!formData.ideaDescription.trim()) {
      toast({
        title: "Input Required",
        description: "Please describe your business idea to begin the analysis.",
        variant: "destructive",
      })
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setAnalysis(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000)

      const apiEndpoint = useMockApi ? "/api/mock-idea-analysis" : "/api/openai-idea-analysis"

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        if (!useMockApi) {
          setUseMockApi(true)
          const mockResponse = await fetch("/api/mock-idea-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })

          if (!mockResponse.ok) throw new Error("Analysis failed. Please try again later.")

          const data = await mockResponse.json()
          setAnalysis(data.analysis)
          toast({
            title: "Analysis Complete",
            description: "Using offline intelligence for faster results.",
          })
          setIsAnalyzing(false)
          return
        }
        throw new Error("System is currently overloaded. Please try again.")
      }

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      setAnalysis(data.analysis)
      toast({
        title: "Success",
        description: "Your idea has been successfully analyzed by Juno.",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 space-y-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-2 text-primary font-medium tracking-widest uppercase text-xs">
          <Sparkles className="h-3 w-3" />
          Intelligence Module
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Idea Analyser</h1>
        <p className="text-white/40 text-lg">Stress-test your concept before committing a single line of code.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-card border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Lightbulb size={120} className="text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lightbulb className="text-primary h-5 w-5" />
              Idea Blueprint
            </CardTitle>
            <CardDescription className="text-white/40">Provide the core details of your vision.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10">
            <div className="space-y-2">
              <Label htmlFor="ideaDescription" className="text-white/70">The Core Concept</Label>
              <Textarea
                id="ideaDescription"
                placeholder="What is the problem you're solving?"
                value={formData.ideaDescription}
                onChange={(e) => handleInputChange("ideaDescription", e.target.value)}
                className="glass-input min-h-[120px] resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="proposedSolution" className="text-white/70 flex items-center gap-2">
                  <Target size={14} className="text-primary" /> The Solution
                </Label>
                <Textarea
                  id="proposedSolution"
                  placeholder="How does it work?"
                  value={formData.proposedSolution}
                  onChange={(e) => handleInputChange("proposedSolution", e.target.value)}
                  className="glass-input h-24 resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="intendedUsers" className="text-white/70 flex items-center gap-2">
                  <Users size={14} className="text-primary" /> Target Audience
                </Label>
                <Textarea
                  id="intendedUsers"
                  placeholder="Who has this problem?"
                  value={formData.intendedUsers}
                  onChange={(e) => handleInputChange("intendedUsers", e.target.value)}
                  className="glass-input h-24 resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="geographicFocus" className="text-white/70 flex items-center gap-2">
                <Globe size={14} className="text-primary" /> Market Focus
              </Label>
              <Textarea
                id="geographicFocus"
                placeholder="Where will you launch first?"
                value={formData.geographicFocus}
                onChange={(e) => handleInputChange("geographicFocus", e.target.value)}
                className="glass-input h-20 resize-none"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex flex-col">
                <Label htmlFor="use-mock-api" className="text-white font-medium">Turbo Mode</Label>
                <span className="text-[10px] text-white/40 uppercase tracking-widest">Faster, but less granular analysis</span>
              </div>
              <Switch id="use-mock-api" checked={useMockApi} onCheckedChange={setUseMockApi} className="data-[state=checked]:bg-primary" />
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !formData.ideaDescription.trim()}
              className="w-full h-14 bg-primary hover:bg-primary/90 text-black font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(39,174,96,0.2)] transition-all duration-300"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing Intelligence...
                </>
              ) : (
                "Initiate Deep Analysis"
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-red-500/20 bg-red-500/5 backdrop-blur-md">
              <CardContent className="pt-6 flex items-start gap-4">
                <AlertCircle className="text-red-500 h-6 w-6 mt-1 flex-shrink-0" />
                <div className="space-y-1">
                  <h3 className="text-red-500 font-bold">Analysis Terminated</h3>
                  <p className="text-red-400/80 text-sm leading-relaxed">{error}</p>
                  <Button variant="link" onClick={handleAnalyze} className="text-red-400 p-0 h-auto text-xs underline">Try Re-initiating</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {analysis && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 pb-20"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3 italic">
                <CheckCircle2 className="text-primary h-6 w-6" /> Juno's Verdict
              </h2>
              <Button variant="outline" className="text-white/40 border-white/10 hover:bg-white/5 rounded-full px-6">Export PDF</Button>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {analysis.sections.map((section, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <Card className="glass-card border-white/5 hover:border-primary/20 transition-all duration-500">
                    <CardHeader className="bg-white/5">
                      <CardTitle className="text-primary text-sm uppercase tracking-widest">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="text-white/80 leading-relaxed space-y-4">
                        {section.content.split("\n\n").map((p, pi) => (
                          <p key={pi}>{p}</p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="p-8 rounded-3xl bg-primary/10 border border-primary/20 text-center space-y-4"
            >
              <h3 className="text-xl font-bold text-white">Ready to proceed?</h3>
              <p className="text-white/60">Your next step is defining your Value Proposition based on these insights.</p>
              <Button className="bg-primary text-black font-bold h-12 px-10 rounded-full">Continue to Value Prop →</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
