"use client"

import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Brain, TrendingUp, Zap } from "lucide-react"

interface InsightCardProps {
  title: string
  content: string
  icon: React.ReactNode
}

function InsightCard({ title, content, icon }: InsightCardProps) {
  return (
    <Card className="glass-card border-primary/10 overflow-hidden hover:bg-green-900/10 hover:border-green-400/30 hover:shadow-[0_0_15px_rgba(74,222,128,0.1)]">
      <div className="h-1 bg-gradient-to-r from-primary to-primary/50"></div>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <div className="text-white/80 text-sm" dangerouslySetInnerHTML={{ __html: content }}></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ConsumerInsightsCardsProps {
  painPoints: string
  behavioralPatterns: string
  adoptionTriggers: string
  trends: string
}

export function ConsumerInsightsCards({
  painPoints,
  behavioralPatterns,
  adoptionTriggers,
  trends,
}: ConsumerInsightsCardsProps) {
  // Helper function to format content with bullet points
  const formatContent = (content: string) => {
    // Extract first paragraph as summary
    const paragraphs = content.split("\n\n")
    const summary = paragraphs[0]

    // If the content has bullet points (starts with - or *), format them
    if (content.includes("\n- ") || content.includes("\n* ")) {
      const bulletPoints = content.match(/\n[*-] .+/g) || []
      const formattedBullets = bulletPoints
        .slice(0, 3) // Limit to 3 bullet points
        .map((point) => `<li>${point.replace(/\n[*-] /, "")}</li>`)
        .join("")

      return `${summary}<ul class="mt-2 space-y-1 list-disc list-inside">${formattedBullets}</ul>`
    }

    // If no bullet points, just return the summary
    return summary
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      <InsightCard
        title="Consumer Pain Points"
        content={formatContent(painPoints)}
        icon={<AlertTriangle className="h-5 w-5" />}
      />
      <InsightCard
        title="Behavioral Patterns"
        content={formatContent(behavioralPatterns)}
        icon={<Brain className="h-5 w-5" />}
      />
      <InsightCard
        title="Adoption Triggers"
        content={formatContent(adoptionTriggers)}
        icon={<Zap className="h-5 w-5" />}
      />
      <InsightCard
        title="Trends & Cultural Forces"
        content={formatContent(trends)}
        icon={<TrendingUp className="h-5 w-5" />}
      />
    </div>
  )
}
