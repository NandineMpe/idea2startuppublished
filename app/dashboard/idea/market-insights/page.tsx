"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  PieChart,
  Target,
  Download,
  Copy,
  Search,
  BookmarkIcon,
  CheckCircle2,
  Zap,
  Brain,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { marked } from "marked"
import { parseMarketSizeData, parseConsumerInsightsData } from "@/utils/market-insights-parser"
import { MarketSizeChart } from "@/components/visualizations/market-size-chart"

interface AnalysisSection {
  id: string
  title: string
  icon: React.ReactNode
  content: React.ReactNode | null
  isLoading?: boolean
}

export default function ConsumerMarketInsightsPage() {
  const [query, setQuery] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisContent, setAnalysisContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [bookmarked, setBookmarked] = useState(false)
  const [progress, setProgress] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showRecentSearches, setShowRecentSearches] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [marketSizeData, setMarketSizeData] = useState<any>(null)
  const [consumerInsightsData, setConsumerInsightsData] = useState<any>(null)
  const [sections, setSections] = useState<AnalysisSection[]>([])
  const [activeCalculationDetail, setActiveCalculationDetail] = useState<string | null>(null)

  // Function to clean markdown content by removing reference placeholders
  const cleanMarkdown = (content: string) => {
    if (!content) return ""
    // Remove reference placeholders like [1], [2], etc.
    return content.replace(/\[\d+\]/g, "")
  }

  // Simulate progress during analysis
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isAnalyzing) {
      setProgress(0)
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(interval)
            return 95
          }
          return prev + Math.random() * 10
        })
      }, 500)
    } else {
      setProgress(100)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAnalyzing])

  // Configure marked options
  useEffect(() => {
    marked.setOptions({
      breaks: true,
      gfm: true,
    })
  }, [])

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  // Toggle calculation details
  const toggleCalculationDetail = (calcId: string) => {
    setActiveCalculationDetail(activeCalculationDetail === calcId ? null : calcId)
  }

  const handleAnalyze = async () => {
    if (!query.trim()) return

    setIsAnalyzing(true)
    setAnalysisContent(null)
    setError(null)
    setBookmarked(false)
    setCopied(false)
    setSearchTerm("")
    setMarketSizeData(null)
    setConsumerInsightsData(null)
    setSections([])
    setExpandedSections({})
    setActiveCalculationDetail(null)

    // Add to recent searches
    if (!recentSearches.includes(query)) {
      const updatedSearches = [query, ...recentSearches.slice(0, 4)]
      setRecentSearches(updatedSearches)
    }

    try {
      console.log("Starting market analysis for:", query)

      const response = await fetch("/api/analyze-market-simple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("API response not OK:", response.status, errorData)
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.content) {
        console.error("No content in API response:", data)
        throw new Error("No analysis content was returned")
      }

      console.log("Received analysis content")

      // Clean the content
      const cleanedContent = cleanMarkdown(data.content)
      setAnalysisContent(cleanedContent)

      // Parse the content for visualization data
      const parsedMarketSizeData = parseMarketSizeData(cleanedContent)
      const parsedConsumerInsightsData = parseConsumerInsightsData(cleanedContent)

      console.log("Parsed market size data:", parsedMarketSizeData)
      console.log("Parsed consumer insights data:", parsedConsumerInsightsData)

      setMarketSizeData(parsedMarketSizeData)
      setConsumerInsightsData(parsedConsumerInsightsData)

      // Create the sections based on the new structure from the system prompt
      const newSections: AnalysisSection[] = [
        {
          id: "foundationalUnderstanding",
          title: "Foundational Understanding",
          icon: <Brain className="h-5 w-5 text-primary" />,
          content: (
            <div
              className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: extractSectionContent(cleanedContent, "Foundational Understanding"),
              }}
            />
          ),
        },
        {
          id: "consumerBehavior",
          title: "Consumer Behavior & Demand Signals",
          icon: <Users className="h-5 w-5 text-primary" />,
          content: (
            <div
              className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: extractSectionContent(cleanedContent, "Consumer Behavior & Demand Signals"),
              }}
            />
          ),
        },
        {
          id: "marketDefinition",
          title: "Market Definition & Size",
          icon: <PieChart className="h-5 w-5 text-primary" />,
          content: (
            <div className="space-y-6">
              <div
                className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary mb-6"
                dangerouslySetInnerHTML={{
                  __html: extractSectionBeforeSubheading(
                    extractSectionContent(cleanedContent, "Market Definition & Size"),
                  ),
                }}
              />

              {parsedMarketSizeData && (
                <div className="text-center mb-8">
                  <p className="text-white/80 mb-6">
                    Estimated market size for {query} based on TAM, SAM, and SOM calculations
                  </p>
                  <MarketSizeChart
                    tam={parsedMarketSizeData.tam}
                    sam={parsedMarketSizeData.sam}
                    som={parsedMarketSizeData.som}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {/* TAM Card */}
                <Card className="glass-card border-blue-600/20 hover:border-blue-600/40 transition-all">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-blue-600/10 p-2 rounded-full">
                          <PieChart className="h-5 w-5 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold">TAM (Total Addressable Market)</h3>
                      </div>
                      <div className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-sm font-medium">
                        {parsedMarketSizeData?.tam?.value || "Not available"}
                      </div>
                    </div>
                    <p className="text-white/70 mb-3">{parsedMarketSizeData?.tam?.description || "Global market"}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-white/60">
                        <span>Method: {parsedMarketSizeData?.tam?.method || "Industry research"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-950/30 p-1 h-auto"
                        onClick={() => toggleCalculationDetail("tam")}
                      >
                        {activeCalculationDetail === "tam" ? "Hide Details" : "Assess Calculation"}
                        {activeCalculationDetail === "tam" ? (
                          <ChevronUp className="ml-1 h-4 w-4" />
                        ) : (
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {activeCalculationDetail === "tam" && (
                      <div className="mt-3 bg-blue-950/20 p-3 rounded-md border border-blue-900/50 text-sm">
                        <div className="mb-2">
                          <span className="text-white/60">Methodology:</span>{" "}
                          <span className="text-white/90">{parsedMarketSizeData?.tamMethodology || "N/A"}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-white/60">Data Source:</span>{" "}
                          <span className="text-white/90">
                            {parsedMarketSizeData?.tam?.source || "Industry reports"}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/60">Confidence:</span>{" "}
                          <span
                            className={`${
                              parsedMarketSizeData?.tam?.confidence === "High"
                                ? "text-green-400"
                                : parsedMarketSizeData?.tam?.confidence === "Moderate"
                                  ? "text-yellow-400"
                                  : "text-orange-400"
                            }`}
                          >
                            {parsedMarketSizeData?.tam?.confidence || "Moderate"}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* SAM Card */}
                <Card className="glass-card border-purple-600/20 hover:border-purple-600/40 transition-all">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-purple-600/10 p-2 rounded-full">
                          <PieChart className="h-5 w-5 text-purple-500" />
                        </div>
                        <h3 className="text-lg font-semibold">SAM (Serviceable Addressable Market)</h3>
                      </div>
                      <div className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-sm font-medium">
                        {parsedMarketSizeData?.sam?.value || "Not available"}
                      </div>
                    </div>
                    <p className="text-white/70 mb-3">
                      {parsedMarketSizeData?.sam?.description || "Serviceable market segment"}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-white/60">
                        <span>Method: {parsedMarketSizeData?.sam?.method || "Geographic filtering"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-purple-400 hover:text-purple-300 hover:bg-purple-950/30 p-1 h-auto"
                        onClick={() => toggleCalculationDetail("sam")}
                      >
                        {activeCalculationDetail === "sam" ? "Hide Details" : "Assess Calculation"}
                        {activeCalculationDetail === "sam" ? (
                          <ChevronUp className="ml-1 h-4 w-4" />
                        ) : (
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {activeCalculationDetail === "sam" && (
                      <div className="mt-3 bg-purple-950/20 p-3 rounded-md border border-purple-900/50 text-sm">
                        <div className="mb-2">
                          <span className="text-white/60">Methodology:</span>{" "}
                          <span className="text-white/90">{parsedMarketSizeData?.samMethodology || "N/A"}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-white/60">Data Source:</span>{" "}
                          <span className="text-white/90">{parsedMarketSizeData?.sam?.source || "Filtered TAM"}</span>
                        </div>
                        <div>
                          <span className="text-white/60">Confidence:</span>{" "}
                          <span
                            className={`${
                              parsedMarketSizeData?.sam?.confidence === "High"
                                ? "text-green-400"
                                : parsedMarketSizeData?.sam?.confidence === "Moderate"
                                  ? "text-yellow-400"
                                  : "text-orange-400"
                            }`}
                          >
                            {parsedMarketSizeData?.sam?.confidence || "Moderate"}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* SOM Card */}
                <Card className="glass-card border-pink-600/20 hover:border-pink-600/40 transition-all">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-pink-600/10 p-2 rounded-full">
                          <PieChart className="h-5 w-5 text-pink-500" />
                        </div>
                        <h3 className="text-lg font-semibold">SOM (Serviceable Obtainable Market)</h3>
                      </div>
                      <div className="bg-pink-500/10 text-pink-400 px-3 py-1 rounded-full text-sm font-medium">
                        {parsedMarketSizeData?.som?.value || "Not available"}
                      </div>
                    </div>
                    <p className="text-white/70 mb-3">
                      {parsedMarketSizeData?.som?.description || "Obtainable market share"}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sm text-white/60">
                        <span>Method: {parsedMarketSizeData?.som?.method || "Realistic projection"}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-pink-400 hover:text-pink-300 hover:bg-pink-950/30 p-1 h-auto"
                        onClick={() => toggleCalculationDetail("som")}
                      >
                        {activeCalculationDetail === "som" ? "Hide Details" : "Assess Calculation"}
                        {activeCalculationDetail === "som" ? (
                          <ChevronUp className="ml-1 h-4 w-4" />
                        ) : (
                          <ChevronDown className="ml-1 h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {activeCalculationDetail === "som" && (
                      <div className="mt-3 bg-pink-950/20 p-3 rounded-md border border-pink-900/50 text-sm">
                        <div className="mb-2">
                          <span className="text-white/60">Methodology:</span>{" "}
                          <span className="text-white/90">{parsedMarketSizeData?.somMethodology || "N/A"}</span>
                        </div>
                        <div className="mb-2">
                          <span className="text-white/60">Data Source:</span>{" "}
                          <span className="text-white/90">
                            {parsedMarketSizeData?.som?.source || "Competitor analysis"}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/60">Confidence:</span>{" "}
                          <span
                            className={`${
                              parsedMarketSizeData?.som?.confidence === "High"
                                ? "text-green-400"
                                : parsedMarketSizeData?.som?.confidence === "Moderate"
                                  ? "text-yellow-400"
                                  : "text-orange-400"
                            }`}
                          >
                            {parsedMarketSizeData?.som?.confidence || "Low"}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ),
        },
        {
          id: "competitiveAnalysis",
          title: "Competitive & Contextual Analysis",
          icon: <Target className="h-5 w-5 text-primary" />,
          content: (
            <div
              className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: extractSectionContent(cleanedContent, "Competitive & Contextual Analysis"),
              }}
            />
          ),
        },
        {
          id: "strategicTakeaways",
          title: "Strategic Takeaways",
          icon: <Zap className="h-5 w-5 text-primary" />,
          content: (
            <div
              className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: extractSectionContent(cleanedContent, "Strategic Takeaways"),
              }}
            />
          ),
        },
      ]

      // Add a full analysis section at the end
      newSections.push({
        id: "fullAnalysis",
        title: "Full Analysis",
        icon: <BookmarkIcon className="h-5 w-5 text-primary" />,
        content: (
          <div
            id="fullAnalysis"
            className="prose prose-invert max-w-none prose-headings:text-primary prose-a:text-primary prose-strong:text-white prose-headings:border-b prose-headings:border-gray-800 prose-headings:pb-2 prose-headings:mb-4 prose-h2:mt-8 prose-p:text-white/80 prose-li:text-white/80"
          >
            <div dangerouslySetInnerHTML={{ __html: highlightSearchTerm(cleanedContent) }} />
          </div>
        ),
      })

      setSections(newSections)

      // Expand the first section by default
      setExpandedSections({ foundationalUnderstanding: true })

      // Scroll to top of content
      if (contentRef.current) {
        contentRef.current.scrollTop = 0
      }
    } catch (error) {
      console.error("Error analyzing market:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopyContent = () => {
    if (analysisContent) {
      navigator.clipboard.writeText(analysisContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleBookmark = () => {
    setBookmarked(!bookmarked)
  }

  const handleExport = () => {
    if (!analysisContent || !query) return

    const element = document.createElement("a")
    const file = new Blob([analysisContent], { type: "text/markdown" })
    element.href = URL.createObjectURL(file)
    element.download = `${query.replace(/\s+/g, "-").toLowerCase()}-market-analysis.md`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  const highlightSearchTerm = (content: string) => {
    if (!searchTerm.trim() || !content) {
      return marked(content || "")
    }

    try {
      const regex = new RegExp(`(${searchTerm})`, "gi")
      const highlightedContent = content.replace(regex, '<mark class="bg-primary/20 text-white px-1 rounded">$1</mark>')
      return marked(highlightedContent)
    } catch (error) {
      console.error("Error highlighting search term:", error)
      return marked(content)
    }
  }

  // Helper function to extract content for a specific section
  function extractSectionContent(content: string, sectionTitle: string): string {
    if (!content) return ""

    try {
      // Create a more flexible regex pattern that can match different heading formats
      // This handles both exact matches and partial matches in section titles
      const escapedTitle = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const sectionRegex = new RegExp(`## ${escapedTitle}([\\s\\S]*?)(?=^## |$)`, "m")
      const altSectionRegex = new RegExp(`##\\s+[^\\n]*${escapedTitle}[^\\n]*([\\s\\S]*?)(?=^## |$)`, "m")

      let match = content.match(sectionRegex)

      // If exact match not found, try alternative pattern
      if (!match || !match[1]) {
        match = content.match(altSectionRegex)
      }

      if (match && match[1]) {
        return marked(match[1].trim())
      }

      // If still no match, try to find any section that might contain relevant keywords
      if (sectionTitle === "Consumer Behavior & Demand Signals") {
        // Try alternative section titles that might contain consumer behavior info
        const altTitles = [
          "Consumer Behavior",
          "Consumer Insights",
          "Demand Signals",
          "Customer Behavior",
          "Behavioral Patterns",
        ]

        for (const altTitle of altTitles) {
          const altRegex = new RegExp(`## ${altTitle}([\\s\\S]*?)(?=^## |$)`, "m")
          const altMatch = content.match(altRegex)
          if (altMatch && altMatch[1]) {
            return marked(altMatch[1].trim())
          }
        }
      }

      return `<p>No content found for ${sectionTitle}. This section may be included in another part of the analysis.</p>`
    } catch (error) {
      console.error(`Error extracting section ${sectionTitle}:`, error)
      return `<p>Error extracting section ${sectionTitle}</p>`
    }
  }

  // Helper function to extract content before any subheading
  function extractSectionBeforeSubheading(htmlContent: string): string {
    if (!htmlContent) return ""

    // Extract content before the first <h3> tag if it exists
    const beforeH3 = htmlContent.split("<h3")[0]
    return beforeH3 || htmlContent
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Consumer and Market Insights</h1>
        <p className="text-white/60">Deep market analysis for your business</p>
      </div>

      {error && (
        <Card className="glass-card border-red-800/50 bg-red-900/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-500">Error</h3>
              <p className="text-white/80">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!analysisContent ? (
        <div className="space-y-8">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">
              Consumer and Market <span className="text-primary">Insights</span>
            </h2>
            <p className="text-white/80 max-w-3xl">
              Our advanced market research tool provides deep, non-obvious consumer insights that fuel startup ideation,
              product-market fit, and category-defining strategy. We uncover the truth behind consumer behavior and
              market demand, translating it into actionable insights for founders and product builders.
            </p>
            <p className="text-white/80 max-w-3xl">
              Unlike surface-level summaries or recycled startup advice, our analysis delivers clarity, critical
              assessment, and original insight that cuts through noise and drives decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card border-primary/10 overflow-hidden group hover:border-primary transition-all duration-300">
              <div className="h-1 bg-gradient-to-r from-primary to-primary/50"></div>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all duration-300">
                  <PieChart className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-4">Market Definition & Size</h3>
                <p className="text-white/80">
                  Get a comprehensive analysis of your market size with TAM, SAM, and SOM calculations based on credible
                  assumptions.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10 overflow-hidden group hover:border-primary transition-all duration-300">
              <div className="h-1 bg-gradient-to-r from-primary to-primary/50"></div>
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-all duration-300">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-primary mb-4">Detailed Insights</h3>
                <p className="text-white/80">
                  Discover comprehensive insights about market dynamics, consumer behavior, trends, and opportunities.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card border-primary/10 p-6">
            <div className="flex flex-col gap-4">
              <div className="relative">
                <label htmlFor="market-query" className="text-sm font-medium text-white/60 mb-2 block">
                  Enter an industry, product, or market to analyze
                </label>
                <div className="relative">
                  <Input
                    id="market-query"
                    className="bg-black border-gray-800 focus:border-primary text-white pr-10"
                    placeholder="e.g., Electric vehicles, Plant-based meat, Cryptocurrency"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setShowRecentSearches(e.target.value.length > 0 && recentSearches.length > 0)
                    }}
                    onFocus={() => setShowRecentSearches(recentSearches.length > 0)}
                    onBlur={() => setTimeout(() => setShowRecentSearches(false), 200)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  />
                  {query && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                      onClick={() => setQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Recent searches dropdown */}
                {showRecentSearches && recentSearches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-gray-900 border border-gray-800 rounded-md shadow-lg">
                    <div className="py-1 text-sm text-white/60 px-3">Recent searches</div>
                    {recentSearches
                      .filter((search) => search.toLowerCase().includes(query.toLowerCase()))
                      .map((search, index) => (
                        <button
                          key={index}
                          className="w-full text-left px-4 py-2 hover:bg-gray-800 text-white flex items-center"
                          onClick={() => {
                            setQuery(search)
                            setShowRecentSearches(false)
                          }}
                        >
                          <Search className="h-4 w-4 mr-2 text-white/60" />
                          {search}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  className="bg-primary hover:bg-primary/90 text-black px-6 py-2 h-auto flex-1 sm:flex-none"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !query.trim()}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Analyze Market
                    </>
                  )}
                </Button>
              </div>

              {isAnalyzing && (
                <div className="mt-2">
                  <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-white/60">
                    <span>Gathering data</span>
                    <span>Analyzing insights</span>
                    <span>Finalizing report</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center">
                <span className="text-primary mr-2">{query}</span>
                <span className="text-sm text-white/60 font-normal bg-gray-800 px-2 py-1 rounded">Market Analysis</span>
              </h2>
              <p className="text-white/60 text-sm mt-1">Analysis generated on {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
                <Input
                  placeholder="Search in content..."
                  className="pl-9 bg-black border-gray-800 h-9"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-800 hover:bg-gray-800 h-9"
                onClick={handleCopyContent}
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-800 hover:bg-gray-800 h-9"
                onClick={handleExport}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-800 hover:bg-gray-800 h-9"
                onClick={handleBookmark}
              >
                {bookmarked ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                    Saved
                  </>
                ) : (
                  <>
                    <BookmarkIcon className="h-4 w-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-800 hover:bg-gray-800 h-9"
                onClick={() => {
                  setAnalysisContent(null)
                  setError(null)
                  setSections([])
                }}
              >
                New Analysis
              </Button>
            </div>
          </div>

          <div ref={contentRef} className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="border border-primary/20 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 bg-black hover:bg-gray-900 text-white"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">{section.icon}</div>
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                  </div>
                  {expandedSections[section.id] ? (
                    <ChevronUp className="h-5 w-5 text-white/60" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-white/60" />
                  )}
                </button>
                {expandedSections[section.id] && (
                  <div className="p-6 border-t border-primary/20 bg-gray-900">
                    {section.isLoading ? (
                      <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : section.content && section.content.toString().includes("No content found") ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="h-10 w-10 text-primary/50 mb-4" />
                        <p className="text-white/60 max-w-md">
                          This section may be included in another part of the analysis or structured differently. Please
                          check the Full Analysis section to see all content.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 border-primary/20 hover:bg-primary/10"
                          onClick={() => {
                            setExpandedSections((prev) => ({ ...prev, fullAnalysis: true }))
                            // Scroll to full analysis section
                            setTimeout(() => {
                              document.getElementById("fullAnalysis")?.scrollIntoView({ behavior: "smooth" })
                            }, 100)
                          }}
                        >
                          View Full Analysis
                        </Button>
                      </div>
                    ) : (
                      section.content
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper component for X icon
function X(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
