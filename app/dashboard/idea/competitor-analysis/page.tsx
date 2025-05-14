"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Info, Loader2 } from "lucide-react"

export default function CompetitorAnalysisPage() {
  const [problem, setProblem] = useState("")
  const [uniqueEdge, setUniqueEdge] = useState("")
  const [edgePills, setEdgePills] = useState<string[]>([])
  const [knownGaps, setKnownGaps] = useState("")
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pillOptions = ["Better UX", "New technology", "Untapped segment"]

  function togglePill(pill: string) {
    setEdgePills((prev) => (prev.includes(pill) ? prev.filter((p) => p !== pill) : [...prev, pill]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setAnalysis(null)
    try {
      const res = await fetch("/api/idea-to-product/competitor-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, uniqueEdge, edgePills, knownGaps }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to analyze")
      setAnalysis(data.result || "No analysis returned.")
    } catch (e: any) {
      setError(e.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  // Function to extract sections from the analysis
  const extractSection = (sectionName: string) => {
    if (!analysis) return null

    const regex = new RegExp(`## ${sectionName}([\\s\\S]*?)(?=## |$)`, "i")
    const match = analysis.match(regex)
    return match ? match[1].trim() : null
  }

  // Function to format markdown content
  const formatMarkdown = (content: string | null) => {
    if (!content) return null

    // Process the content to handle various markdown elements
    let formatted = content

    // Handle bullet points (both - and * styles)
    formatted = formatted.replace(/^[\s]*[-*][\s]+(.*)/gm, "<li>$1</li>")

    // Handle numbered lists
    formatted = formatted.replace(/^[\s]*(\d+)\.[\s]+(.*)/gm, "<li>$2</li>")

    // Wrap adjacent list items in ul tags
    formatted = formatted.replace(/<li>(.*?)<\/li>(\s*<li>)/g, "<li>$1</li>\n<li>")
    formatted = formatted.replace(/(<li>.*?<\/li>(\s*<li>.*?<\/li>)*)/g, '<ul class="list-disc pl-5 my-2">$1</ul>')

    // Handle bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>')

    // Handle italic text
    formatted = formatted.replace(/\*(.*?)\*/g, "<em>$1</em>")

    // Handle links
    formatted = formatted.replace(
      /\[(.*?)\]$(.*?)$/g,
      '<a href="$2" class="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">$1</a>',
    )

    // Handle paragraphs
    formatted = formatted.replace(/\n\n/g, '</p><p class="my-2">')

    // Wrap the whole thing in a paragraph if it doesn't start with a list
    if (!formatted.startsWith("<ul")) {
      formatted = `<p class="my-2">${formatted}</p>`
    }

    return formatted
  }

  // Function to extract competitor names for navigation
  const extractCompetitorNames = (content: string | null) => {
    if (!content) return []

    // Try to extract from numbered list format (1. Company Name)
    const numberedListRegex = /\d+\.\s+([^•\n]+)/g
    const numberedMatches = [...content.matchAll(numberedListRegex)].map((match) => match[1].trim())

    if (numberedMatches.length > 0) return numberedMatches

    // Try to extract from bold format (**Company Name**)
    const boldRegex = /\*\*([^*]+)\*\*/g
    const boldMatches = [...content.matchAll(boldRegex)].map((match) => match[1].trim())

    return boldMatches
  }

  const marketContext = extractSection("Market Context")
  const keyCompetitors = extractSection("Key Competitors")
  const competitorSummaries = extractSection("Competitor Summaries")
  const strategicGaps = extractSection("Strategic Gaps & Opportunities")
  const implications = extractSection("Implications for New Entrants")

  const competitorNames = extractCompetitorNames(keyCompetitors)

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-6">Competitor Analysis</h1>
      <p className="text-white/60 mb-8">Analyze your competition and identify your unique advantages in the market.</p>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-8">
        {/* Problem Framing Card */}
        <Card className="glass-card border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold text-white">What market are you interested in?</CardTitle>
              <span className="group relative">
                <Info className="w-4 h-4 text-primary cursor-pointer" />
                <span className="absolute left-6 top-0 z-10 hidden group-hover:block min-w-[220px] bg-gray-900 text-gray-100 text-xs rounded-lg px-3 py-2 shadow-lg border border-gray-700">
                  Enter a market category, product type, or industry you want to analyze.
                </span>
              </span>
            </div>
            <CardDescription className="text-white/60">
              <span className="italic text-white/40">
                e.g., "Social fitness apps" or "Enterprise knowledge management"
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g., Climate tech for carbon credits"
              className="glass-input text-white border-primary/10 focus-visible:ring-primary/30 resize-none min-h-[90px]"
            />
          </CardContent>
        </Card>

        {/* Optional additional context */}
        <Card className="glass-card border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Additional context (optional)</CardTitle>
            <CardDescription className="text-white/60">
              Provide any additional details that might help with the analysis.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {pillOptions.map((pill) => (
                <Button
                  key={pill}
                  type="button"
                  variant={edgePills.includes(pill) ? "default" : "outline"}
                  className={
                    edgePills.includes(pill)
                      ? "bg-primary text-black border-primary hover:bg-primary/90"
                      : "border-gray-700 text-white hover:bg-gray-800"
                  }
                  onClick={() => togglePill(pill)}
                >
                  {pill}
                </Button>
              ))}
            </div>
            <Textarea
              value={uniqueEdge}
              onChange={(e) => setUniqueEdge(e.target.value)}
              placeholder="Any specific aspects of this market you're interested in..."
              className="glass-input text-white border-primary/10 focus-visible:ring-primary/30 resize-none min-h-[60px]"
            />
            <div>
              <label className="block text-sm font-medium text-white/60 mb-1">
                Known gaps or opportunities? <span className="text-white/40">(optional)</span>
              </label>
              <Textarea
                value={knownGaps}
                onChange={(e) => setKnownGaps(e.target.value)}
                placeholder="e.g., underserved customer segments, technological gaps..."
                className="glass-input text-white border-primary/10 focus-visible:ring-primary/30 resize-none min-h-[60px]"
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-900/20 border border-red-700/50 text-red-200 rounded-lg p-4">
            <b>Error:</b> {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-primary animate-pulse">
            <Loader2 className="animate-spin" /> Generating competitor analysis...
          </div>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-primary hover:bg-primary/90 text-black font-semibold"
            disabled={loading || !problem}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
            Generate Analysis
          </Button>
        </div>
      </form>

      {analysis && (
        <div className="mt-8 max-w-4xl">
          {/* Quick navigation */}
          {competitorNames.length > 0 && (
            <div className="mb-6 bg-gray-900/50 p-4 rounded-lg border border-primary/20">
              <h3 className="text-white font-medium mb-2">Quick Navigation:</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700 text-white hover:bg-gray-800"
                  onClick={() => document.getElementById("market-context")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Market Context
                </Button>
                {competitorNames.map((name, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs border-gray-700 text-white hover:bg-gray-800"
                    onClick={() => document.getElementById(`competitor-${idx}`)?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {name}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700 text-white hover:bg-gray-800"
                  onClick={() => document.getElementById("strategic-gaps")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Strategic Gaps
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700 text-white hover:bg-gray-800"
                  onClick={() => document.getElementById("implications")?.scrollIntoView({ behavior: "smooth" })}
                >
                  Implications
                </Button>
              </div>
            </div>
          )}

          {/* Market Context Section */}
          <Card id="market-context" className="glass-card border-primary/10 mb-6">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-xl font-semibold text-primary">Market Context</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {marketContext ? (
                <div
                  className="text-white/80 text-sm space-y-2 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(marketContext) || "" }}
                />
              ) : (
                <p className="text-white/60 italic">No market context available.</p>
              )}
            </CardContent>
          </Card>

          {/* Key Competitors Section */}
          <Card className="glass-card border-primary/10 mb-6">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-xl font-semibold text-primary">Key Competitors</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {keyCompetitors ? (
                <div className="text-white/80 text-sm space-y-2 leading-relaxed">
                  {competitorNames.length > 0 ? (
                    <div className="space-y-4">
                      {competitorNames.map((name, idx) => (
                        <div
                          key={idx}
                          id={`competitor-${idx}`}
                          className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
                        >
                          <h3 className="text-primary font-medium mb-2">
                            {idx + 1}. {name}
                          </h3>
                          <div className="text-sm text-white/70">
                            {/* We'll display the raw competitor info for now */}
                            {keyCompetitors.includes(name) &&
                              keyCompetitors.split(name)[1]?.split(/\d+\./)[0]?.trim().replace(/•/g, "•  ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="text-white/80"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(keyCompetitors) || "" }}
                    />
                  )}
                </div>
              ) : (
                <p className="text-white/60 italic">No competitor information available.</p>
              )}
            </CardContent>
          </Card>

          {/* Competitor Summaries Section */}
          {competitorSummaries && (
            <Card className="glass-card border-primary/10 mb-6">
              <CardHeader className="border-b border-gray-800">
                <CardTitle className="text-xl font-semibold text-primary">Competitor Summaries</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div
                  className="text-white/80 text-sm space-y-4 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(competitorSummaries) || "" }}
                />
              </CardContent>
            </Card>
          )}

          {/* Strategic Gaps & Opportunities Section */}
          <Card id="strategic-gaps" className="glass-card border-primary/10 mb-6">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-xl font-semibold text-primary">Strategic Gaps & Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {strategicGaps ? (
                <div
                  className="text-white/80 text-sm space-y-2 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(strategicGaps) || "" }}
                />
              ) : (
                <p className="text-white/60 italic">No strategic gaps information available.</p>
              )}
            </CardContent>
          </Card>

          {/* Implications for New Entrants Section */}
          <Card id="implications" className="glass-card border-primary/10 mb-6">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-xl font-semibold text-primary">Implications for New Entrants</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {implications ? (
                <div
                  className="text-white/80 text-sm space-y-2 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(implications) || "" }}
                />
              ) : (
                <p className="text-white/60 italic">No implications information available.</p>
              )}
            </CardContent>
          </Card>

          {/* Full Analysis (for reference) */}
          <Card className="glass-card border-primary/10 mb-6">
            <CardHeader className="border-b border-gray-800">
              <CardTitle className="text-xl font-semibold text-primary">Full Analysis</CardTitle>
              <CardDescription className="text-white/60">Complete unformatted analysis for reference</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-800 overflow-auto max-h-[500px]">
                <pre className="whitespace-pre-wrap text-white/80 text-sm font-mono">{analysis}</pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
