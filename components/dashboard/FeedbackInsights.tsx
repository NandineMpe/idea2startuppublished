"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MessageSquare,
  Users,
  BarChart,
  ThumbsUp,
  ThumbsDown,
  Star,
  Filter,
  Download,
  PlusCircle,
  Lightbulb,
  TrendingUp,
  AlertCircle,
  Trash2,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Types for feedback data
interface FeedbackItem {
  id: number
  source: string
  content: string
  category: string
  tags: string[]
  sentiment: "positive" | "negative" | "neutral"
  rating?: number
  createdAt: string
}

// Sample insights data
const sampleInsights = [
  {
    id: 1,
    title: "Onboarding Success",
    description: "Users consistently praise the onboarding experience, with 92% completing it without assistance.",
    impact: "high",
    category: "User Experience",
    actionable: true,
  },
  {
    id: 2,
    title: "Pricing Confusion",
    description: "27% of users report confusion about pricing tiers and which features are included in each plan.",
    impact: "medium",
    category: "Pricing",
    actionable: true,
  },
  {
    id: 3,
    title: "Feature Request: Export Options",
    description: "Multiple users have requested additional export formats for analytics data.",
    impact: "low",
    category: "Features",
    actionable: true,
  },
  {
    id: 4,
    title: "Performance Praise",
    description: "Users from larger organizations particularly value the platform's speed and efficiency.",
    impact: "medium",
    category: "Performance",
    actionable: false,
  },
  {
    id: 5,
    title: "Integration Documentation",
    description: "Technical users are struggling with integrations due to limited documentation.",
    impact: "high",
    category: "Integration",
    actionable: true,
  },
]

export default function FeedbackInsights() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("feedback")
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newFeedback, setNewFeedback] = useState({
    source: "",
    content: "",
    category: "User Experience",
    tags: "",
    sentiment: "neutral" as "positive" | "negative" | "neutral",
    rating: 3,
  })

  // Fetch feedback data
  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/feedback")
        const data = await response.json()

        if (data.feedback && data.feedback.length > 0) {
          setFeedback(data.feedback)
        } else {
          // Use sample data if no feedback exists yet
          setFeedback([
            {
              id: 1,
              source: "User Interview",
              content: "I love how intuitive the onboarding process is. It took me less than 5 minutes to get started.",
              category: "User Experience",
              tags: ["onboarding", "ux"],
              sentiment: "positive",
              rating: 4.5,
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              source: "Customer Support",
              content: "The pricing page is confusing. I couldn't figure out which plan was right for my needs.",
              category: "Pricing",
              tags: ["pricing", "confusion"],
              sentiment: "negative",
              rating: 2.0,
              createdAt: new Date(Date.now() - 86400000).toISOString(),
            },
            {
              id: 3,
              source: "Product Survey",
              content: "The analytics dashboard is useful, but I wish it had more export options for reports.",
              category: "Features",
              tags: ["analytics", "export"],
              sentiment: "neutral",
              rating: 3.5,
              createdAt: new Date(Date.now() - 172800000).toISOString(),
            },
          ])
        }
      } catch (error) {
        console.error("Error fetching feedback:", error)
        toast({
          title: "Error",
          description: "Failed to load feedback data",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeedback()
  }, [toast])

  const handleInputChange = (field: string, value: string | number) => {
    setNewFeedback((prev) => ({ ...prev, [field]: value }))
  }

  const handleSentimentChange = (sentiment: "positive" | "negative" | "neutral") => {
    setNewFeedback((prev) => ({ ...prev, sentiment }))
  }

  const handleRatingChange = (rating: number) => {
    setNewFeedback((prev) => ({ ...prev, rating }))
  }

  const handleAddFeedback = async () => {
    if (!newFeedback.source || !newFeedback.content) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newFeedback,
          tags: newFeedback.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setFeedback((prev) => [data.item, ...prev])
        setNewFeedback({
          source: "",
          content: "",
          category: "User Experience",
          tags: "",
          sentiment: "neutral",
          rating: 3,
        })
        setShowAddForm(false)
        toast({
          title: "Success",
          description: "Feedback added successfully",
        })
      }
    } catch (error) {
      console.error("Error adding feedback:", error)
      toast({
        title: "Error",
        description: "Failed to add feedback",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteFeedback = async (id: number) => {
    setIsDeleting(id)
    try {
      const response = await fetch("/api/feedback", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      })

      const data = await response.json()

      if (data.success) {
        setFeedback((prev) => prev.filter((item) => item.id !== id))
        toast({
          title: "Success",
          description: "Feedback deleted successfully",
        })
      }
    } catch (error) {
      console.error("Error deleting feedback:", error)
      toast({
        title: "Error",
        description: "Failed to delete feedback",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return <ThumbsUp className="h-4 w-4 text-primary" />
      case "negative":
        return <ThumbsDown className="h-4 w-4 text-red-500" />
      default:
        return <Star className="h-4 w-4 text-yellow-500" />
    }
  }

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "high":
        return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">High Impact</span>
      case "medium":
        return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Medium Impact</span>
      case "low":
        return <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">Low Impact</span>
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Feedback & Insights</h1>
        <p className="text-white/60">Collect, analyze, and act on customer feedback to improve your startup.</p>
      </div>

      <Tabs defaultValue="feedback" className="space-y-6" onValueChange={setActiveTab}>
        <div className="flex justify-between items-center">
          <TabsList className="bg-black border border-primary/20 rounded-full p-1">
            <TabsTrigger
              value="feedback"
              className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-white"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Feedback Collection
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-white"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="rounded-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none text-white"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Trends
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            {activeTab === "feedback" && (
              <Button
                className="bg-primary hover:bg-primary/90 text-black"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? (
                  "Cancel"
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Feedback
                  </>
                )}
              </Button>
            )}
            {activeTab === "insights" && (
              <Button className="bg-primary hover:bg-primary/90 text-black">
                <Download className="h-4 w-4 mr-2" />
                Export Insights
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="feedback" className="space-y-6">
          {showAddForm && (
            <Card className="glass-card border-primary/10">
              <CardHeader>
                <CardTitle className="text-white">Add New Feedback</CardTitle>
                <CardDescription className="text-white/80">
                  Record customer feedback from interviews, support conversations, or surveys.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="source" className="text-white">
                      Feedback Source
                    </Label>
                    <Input
                      id="source"
                      placeholder="e.g., User Interview, Survey, Support"
                      className="glass-input text-white border-primary/10 focus-visible:ring-primary/30"
                      value={newFeedback.source}
                      onChange={(e) => handleInputChange("source", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-white">
                      Category
                    </Label>
                    <select
                      id="category"
                      className="w-full glass-input text-white border-primary/10 focus-visible:ring-primary/30 rounded-md p-2"
                      value={newFeedback.category}
                      onChange={(e) => handleInputChange("category", e.target.value)}
                    >
                      <option value="User Experience">User Experience</option>
                      <option value="Features">Features</option>
                      <option value="Pricing">Pricing</option>
                      <option value="Performance">Performance</option>
                      <option value="Integration">Integration</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feedback" className="text-white">
                    Feedback Content
                  </Label>
                  <Textarea
                    id="feedback"
                    placeholder="Enter the feedback here..."
                    className="min-h-[120px] glass-input text-white border-primary/10 focus-visible:ring-primary/30"
                    value={newFeedback.content}
                    onChange={(e) => handleInputChange("content", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Sentiment</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className={`flex-1 ${
                        newFeedback.sentiment === "positive"
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-black border-gray-700 text-white"
                      }`}
                      onClick={() => handleSentimentChange("positive")}
                    >
                      <ThumbsUp className="h-4 w-4 mr-2" />
                      Positive
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`flex-1 ${
                        newFeedback.sentiment === "neutral"
                          ? "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                          : "bg-black border-gray-700 text-white"
                      }`}
                      onClick={() => handleSentimentChange("neutral")}
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Neutral
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={`flex-1 ${
                        newFeedback.sentiment === "negative"
                          ? "bg-red-500/10 border-red-500 text-red-500"
                          : "bg-black border-gray-700 text-white"
                      }`}
                      onClick={() => handleSentimentChange("negative")}
                    >
                      <ThumbsDown className="h-4 w-4 mr-2" />
                      Negative
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Rating (1-5)</Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Button
                        key={rating}
                        type="button"
                        variant="outline"
                        className={`flex-1 ${
                          newFeedback.rating === rating
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-black border-gray-700 text-white"
                        }`}
                        onClick={() => handleRatingChange(rating)}
                      >
                        {rating}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-white">
                    Tags (comma separated)
                  </Label>
                  <Input
                    id="tags"
                    placeholder="e.g., onboarding, pricing, feature-request"
                    className="glass-input text-white border-primary/10 focus-visible:ring-primary/30"
                    value={newFeedback.tags}
                    onChange={(e) => handleInputChange("tags", e.target.value)}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    className="bg-primary hover:bg-primary/90 text-black"
                    onClick={handleAddFeedback}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Feedback"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="glass-card border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-white">Feedback Collection</CardTitle>
                <CardDescription className="text-white/80">
                  Browse and analyze feedback from your customers.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                className="border-primary/20 bg-black hover:bg-primary/10 hover:border-primary/50 text-white"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              ) : feedback.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-primary/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No feedback yet</h3>
                  <p className="text-white/60 max-w-md mx-auto">
                    Start collecting feedback from your customers to improve your product.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {getSentimentIcon(item.sentiment)}
                          <span className="font-medium text-white">{item.source}</span>
                          <span className="text-xs text-white/60">{formatDate(item.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.rating && (
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < Math.floor(item.rating) ? "text-yellow-400" : "text-gray-600"
                                  }`}
                                  fill={i < Math.floor(item.rating) ? "currentColor" : "none"}
                                />
                              ))}
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-white/60 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => handleDeleteFeedback(item.id)}
                            disabled={isDeleting === item.id}
                          >
                            {isDeleting === item.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-white/80 mb-2">{item.content}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">
                          {item.category}
                        </span>
                        {item.tags &&
                          item.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 text-xs rounded-full bg-gray-800 text-white/70">
                              {tag}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <Card className="glass-card border-primary/10">
            <CardHeader>
              <CardTitle className="text-white">AI-Generated Insights</CardTitle>
              <CardDescription className="text-white/80">
                Our AI analyzes your feedback to identify patterns and actionable insights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sampleInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 rounded-lg border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-primary" />
                        <h3 className="font-medium text-white">{insight.title}</h3>
                      </div>
                      <div>{getImpactBadge(insight.impact)}</div>
                    </div>
                    <p className="text-white/80 mb-3">{insight.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">
                        {insight.category}
                      </span>
                      {insight.actionable && (
                        <Button variant="link" className="text-primary p-0 h-auto">
                          Create Action Item
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="glass-card border-primary/10">
            <CardHeader>
              <CardTitle className="text-white">Feedback Trends</CardTitle>
              <CardDescription className="text-white/80">
                Track how feedback and sentiment evolve over time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-12 border border-dashed border-primary/20 rounded-lg">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-primary/50 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Trend Analysis Coming Soon</h3>
                  <p className="text-white/60 max-w-md">
                    We're working on advanced trend analysis features. Check back soon to see how your feedback metrics
                    change over time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Feedback Sources
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">{new Set(feedback.map((item) => item.source)).size}</div>
                <p className="text-sm text-white/60 mt-1">Different feedback channels</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Total Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">{feedback.length}</div>
                <p className="text-sm text-white/60 mt-1">Pieces of feedback collected</p>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-primary" />
                  Sentiment Ratio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-white">
                  {feedback.length > 0
                    ? Math.round(
                        (feedback.filter((item) => item.sentiment === "positive").length / feedback.length) * 100,
                      )
                    : 0}
                  %
                </div>
                <p className="text-sm text-white/60 mt-1">Positive sentiment</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
