"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, GitBranch, Sparkles, Copy, Check, Milestone, Flag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormData {
  productDescription: string
  currentStage: string
  keyGoals: string
  timeline: string
}

export default function RoadmapPage() {
  const [formData, setFormData] = useState<FormData>({
    productDescription: "",
    currentStage: "idea",
    keyGoals: "",
    timeline: "6months",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{ sections: Record<string, string>; raw: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!formData.productDescription.trim()) {
      toast({ title: "Required", description: "Describe your product.", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/generate-roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed"
      setError(message)
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    if (result?.raw) {
      navigator.clipboard.writeText(result.raw)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const phaseColors: Record<string, { border: string; dot: string; bg: string }> = {
    "PHASE 1": { border: "border-l-blue-400", dot: "bg-blue-400", bg: "bg-blue-400/10" },
    "PHASE 2": { border: "border-l-purple-400", dot: "bg-purple-400", bg: "bg-purple-400/10" },
    "PHASE 3": { border: "border-l-pink-400", dot: "bg-pink-400", bg: "bg-pink-400/10" },
    "PHASE 4": { border: "border-l-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-400/10" },
  }

  const getPhaseKey = (sectionName: string): string | null => {
    for (const phase of Object.keys(phaseColors)) {
      if (sectionName.toUpperCase().startsWith(phase)) return phase
    }
    return null
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-purple-400" />
          Product Roadmap Builder
        </h1>
        <p className="text-white/50 mt-1">Generate a phased development plan with milestones, tasks, and success metrics.</p>
      </div>

      {/* Input Form */}
      <Card className="glass-card border-white/5">
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-white/80">Product Description *</Label>
            <Textarea
              placeholder="Describe what you're building, its core features, and who it's for..."
              className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[100px]"
              value={formData.productDescription}
              onChange={(e) => setFormData((p) => ({ ...p, productDescription: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-white/80">Current Stage</Label>
              <Select value={formData.currentStage} onValueChange={(v) => setFormData((p) => ({ ...p, currentStage: v }))}>
                <SelectTrigger className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea / Concept</SelectItem>
                  <SelectItem value="mvp">Building MVP</SelectItem>
                  <SelectItem value="launched">Launched</SelectItem>
                  <SelectItem value="growth">Growing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/80">Timeline</Label>
              <Select value={formData.timeline} onValueChange={(v) => setFormData((p) => ({ ...p, timeline: v }))}>
                <SelectTrigger className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">3 Months</SelectItem>
                  <SelectItem value="6months">6 Months</SelectItem>
                  <SelectItem value="12months">12 Months</SelectItem>
                  <SelectItem value="18months">18 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-white/80">Key Goals</Label>
              <Input
                placeholder="e.g. Launch MVP, get 100 users..."
                className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                value={formData.keyGoals}
                onChange={(e) => setFormData((p) => ({ ...p, keyGoals: e.target.value }))}
              />
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-primary text-black font-semibold hover:bg-primary/90 h-11"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Building Roadmap...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Generate Roadmap</>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Your Product Roadmap</h2>
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/10 text-white/70 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
            </div>

            {/* Timeline visualization */}
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />
              {Object.entries(result.sections).map(([key, content]) => {
                const phaseKey = getPhaseKey(key)
                const colors = phaseKey ? phaseColors[phaseKey] : null

                return (
                  <div key={key} className="relative pl-10 pb-6">
                    <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-black ${colors?.dot || "bg-white/30"}`} />
                    <Card className={`glass-card border-white/5 ${colors ? `border-l-2 ${colors.border}` : ""}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-primary text-sm uppercase tracking-wider flex items-center gap-2">
                          {phaseKey ? <Flag className="h-3.5 w-3.5" /> : <Milestone className="h-3.5 w-3.5" />}
                          {key}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
