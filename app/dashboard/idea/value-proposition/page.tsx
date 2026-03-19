"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Target, Sparkles, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface FormData {
  productDescription: string
  targetCustomer: string
  problemSolved: string
  existingAlternatives: string
}

export default function ValuePropositionPage() {
  const [formData, setFormData] = useState<FormData>({
    productDescription: "",
    targetCustomer: "",
    problemSolved: "",
    existingAlternatives: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{ sections: Record<string, string>; raw: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!formData.productDescription.trim()) {
      toast({ title: "Required", description: "Describe your product or service.", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/generate-value-proposition", {
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
    "HEADLINE", "SUBHEADLINE", "TARGET CUSTOMER", "CUSTOMER JOBS",
    "PAIN RELIEVERS", "GAIN CREATORS", "UNIQUE DIFFERENTIATORS",
    "POSITIONING STATEMENT", "MESSAGING FRAMEWORK", "VALIDATION EXPERIMENTS",
  ]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-6 w-6 text-yellow-400" />
          Value Proposition Generator
        </h1>
        <p className="text-muted-foreground mt-1">Create a compelling value proposition using the Value Proposition Canvas framework.</p>
      </div>

      {/* Input Form */}
      <Card className="glass-card border-border">
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-foreground/80">Product / Service Description *</Label>
            <Textarea
              placeholder="Describe what you're building and what it does..."
              className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40 min-h-[100px]"
              value={formData.productDescription}
              onChange={(e) => setFormData((p) => ({ ...p, productDescription: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-foreground/80">Target Customer</Label>
              <Input
                placeholder="Who is this for? e.g. Solo founders, SMB owners..."
                className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40"
                value={formData.targetCustomer}
                onChange={(e) => setFormData((p) => ({ ...p, targetCustomer: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-foreground/80">Problem Being Solved</Label>
              <Input
                placeholder="What core problem does this address?"
                className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40"
                value={formData.problemSolved}
                onChange={(e) => setFormData((p) => ({ ...p, problemSolved: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-foreground/80">Existing Alternatives</Label>
            <Input
              placeholder="What do customers use today? e.g. Excel, manual process, competitor X..."
              className="mt-1.5 bg-accent border-white/10 text-foreground placeholder:text-muted-foreground/40"
              value={formData.existingAlternatives}
              onChange={(e) => setFormData((p) => ({ ...p, existingAlternatives: e.target.value }))}
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-primary text-black font-semibold hover:bg-primary/90 h-11"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Value Proposition...</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Generate Value Proposition</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-6">
            <p className="text-red-400 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your Value Proposition</h2>
              <Button variant="outline" size="sm" onClick={handleCopy} className="border-white/10 text-muted-foreground gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy All"}
              </Button>
            </div>
            {sectionOrder.map((key) => {
              const content = result.sections[key]
              if (!content) return null
              return (
                <Card key={key} className="glass-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-primary text-sm uppercase tracking-wider">{key}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground/80 text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                  </CardContent>
                </Card>
              )
            })}
            {/* Fallback: render any sections not in sectionOrder */}
            {Object.entries(result.sections)
              .filter(([key]) => !sectionOrder.includes(key))
              .map(([key, content]) => (
                <Card key={key} className="glass-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-primary text-sm uppercase tracking-wider">{key}</CardTitle>
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
