"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Target, ArrowRight } from "lucide-react"

interface MarketDefinitionProps {
  marketDefinition: string
  customerSegments: string[]
}

export function MarketDefinition({ marketDefinition, customerSegments }: MarketDefinitionProps) {
  return (
    <div className="space-y-6 my-6">
      <Card className="glass-card border-primary/10 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/50"></div>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 p-2 rounded-full bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Market Definition</h3>
              <p className="text-white/80">{marketDefinition}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {customerSegments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Key Customer Segments
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {customerSegments.map((segment, index) => (
              <Card
                key={index}
                className="glass-card border-primary/10 bg-primary/5 p-3 hover:bg-green-900/10 hover:border-green-400/30"
              >
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" />
                  <p className="text-white/90 text-sm">{segment}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
