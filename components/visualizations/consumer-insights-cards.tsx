"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Lightbulb } from "lucide-react"

interface ConsumerInsightsData {
  marketDefinition: string
  customerSegments: string[]
  painPoints: string
  behavioralPatterns: string
  adoptionTriggers: string
  trends: string
}

interface ConsumerInsightsCardsProps {
  data: {
    consumerBehavior: string
    marketTrends: string
    competitiveLandscape: string
    regulatoryFactors: string
    fullAnalysis: string
  }
}

export function ConsumerInsightsCards({ data }: ConsumerInsightsCardsProps) {
  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/50"></div>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Consumer Insights</h3>
              <p className="text-white/80">Understand your target audience and their needs.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
