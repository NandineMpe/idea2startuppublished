"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, FileText, Sparkles, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormData {
  businessIdea: string
  targetMarket: string
  revenueApproach: string
  stage: string
}

export default function BusinessModelPage() {
  const [formData, setFormData] = useState<FormData>({
    businessIdea: "",
    targetMarket: "",
    revenueApproach: "",
    stage: "idea",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{ sections: Record<string, string>; raw: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!formData.businessIdea.trim()) {
      toast({ title: "Required", description: "Describe your business idea.", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/generate-business-model", {
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

  const sectionOrder = [
    "VALUE PROPOSITIONS", "CUSTOMER SEGMENTS", "CHANNELS", "CUSTOMER RELATIONSHIPS",
    "REVENUE STREAMS", "KEY RESOURCES", "KEY ACTIVITIES", "KEY PARTNERSHIPS",
    "COST STRUCTURE", "COMPETITIVE MOAT", "UNIT ECONOMICS", "RISKS AND ASSUMPTIONS",
  ]

  const canvasHighlight: Record<string, string> = {
    "VALUE PROPOSITIONS": "border-l-yellow-400",
    "CUSTOMER SEGMENTS": "border-l-blue-400",
    "CHANNELS": "border-l-pink-400",
    "CUSTOMER RELATIONSHIPS": "border-l-purple-400",
    "REVENUE STREAMS": "border-l-emerald-400",
    "KEY RESOURCES": "border-l-orange-400",
    "KEY ACTIVITIES": "border-l-cyan-400",
    "KEY PARTNERSHIPS": "border-l-indigo-400",
    "COST STRUCTURE": "border-l-red-400",
    "COMPETITIVE MOAT": "border-l-primary",
    "UNIT ECONOMICS": "border-l-teal-400",
    "RISKS AND ASSUMPTIONS": "border-l-amber-400",
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-6 w-6 text-yellow-400" />
          Business model workflow
        </h1>
        <p className="text-muted-foreground mt-1">
          Step through Business Model / Lean Canvas with Juno — refine and export what you will actually run.
        </p>
      </div>

      {/* Input Form */}
      <Card className="glass-card border-border">
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-foreground/80">Business Idea *</Label>
            <Textarea
              placeholder="Describe your business idea in detail..."
              className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40 min-h-[100px]"
              value={formData.businessIdea}
              onChange={(e) => setFormData((p) => ({ ...p, businessIdea: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-foreground/80">Target Market</Label>
              <Input
                placeholder="e.g. B2B SaaS, Consumer Mobile..."
                className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40"
                value={formData.targetMarket}
                onChange={(e) => setFormData((p) => ({ ...p, targetMarket: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-foreground/80">Revenue Approach</Label>
              <Input
                placeholder="e.g. Subscription, Freemium, Marketplace..."
                className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40"
                value={formData.revenueApproach}
                onChange={(e) => setFormData((p) => ({ ...p, revenueApproach: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-foreground/80">Current Stage</Label>
              <Select value={formData.stage} onValueChange={(v) => setFormData((p) => ({ ...p, stage: v }))}>
                <SelectTrigger className="mt-1.5 bg-accent border-white/10 text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea Stage</SelectItem>
                  <SelectItem value="mvp">MVP / Prototype</SelectItem>
                  <SelectItem value="launched">Launched / Revenue</SelectItem>
                  <SelectItem value="growth">Growth / Scaling</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-primary text-black font-semibold hover:bg-primary/90 h-11"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running workflow…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Run workflow</>
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
              <h2 className="text-lg font-semibold text-foreground">Business Model Canvas</h2>
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/10 text-muted-foreground gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sectionOrder.map((key) => {
                const content = result.sections[key]
                if (!content) return null
                return (
                  <Card key={key} className={`glass-card border-border border-l-2 ${canvasHighlight[key] || "border-l-white/20"}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-primary text-xs uppercase tracking-wider">{key}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground/80 text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
            {Object.entries(result.sections)
              .filter(([key]) => !sectionOrder.includes(key))
              .map(([key, content]) => (
                <Card key={key} className="glass-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-primary text-xs uppercase tracking-wider">{key}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/80 text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                  </CardContent>
                </Card>
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
