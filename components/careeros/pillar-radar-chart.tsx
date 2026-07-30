"use client"

import { useId, useMemo } from "react"
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

export type PillarRadarPillar = { id: string; name: string; score: number }

const chartConfig = {
  score: {
    label: "Score",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

type PillarRadarChartProps = {
  pillars: PillarRadarPillar[]
  overall: number
  /** Square chart size in px */
  size?: number
  showCenterScore?: boolean
  className?: string
}

export function PillarRadarChart({
  pillars,
  overall,
  size = 260,
  showCenterScore = true,
  className,
}: PillarRadarChartProps) {
  const data = useMemo(
    () =>
      pillars.map((p) => ({
        pillar: p.name,
        score: Math.max(0, Math.min(100, p.score)),
        fullMark: 100,
      })),
    [pillars],
  )

  const gradientId = `pillar-radar-${useId().replace(/:/g, "")}`

  return (
    <div
      className={cn("relative mx-auto", className)}
      style={{ width: size, height: size }}
    >
      <ChartContainer
        config={chartConfig}
        className="h-full w-full [&_.recharts-polar-angle-axis-tick-value]:fill-foreground [&_.recharts-polar-angle-axis-tick-value]:text-[10px] [&_.recharts-polar-angle-axis-tick-value]:font-medium [&_.recharts-surface]:overflow-visible"
        style={{ height: size, width: size }}
      >
        <RadarChart
          data={data}
          cx="50%"
          cy="50%"
          outerRadius="68%"
          margin={{ top: 8, right: 28, bottom: 8, left: 28 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <PolarGrid
            gridType="polygon"
            stroke="hsl(var(--border))"
            strokeOpacity={0.85}
            radialLines={false}
          />
          <PolarAngleAxis
            dataKey="pillar"
            tickLine={false}
            axisLine={false}
            tick={{
              fill: "hsl(var(--foreground))",
              fontSize: size >= 300 ? 11 : 9.5,
              fontWeight: 500,
            }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={4}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={{
              r: size >= 300 ? 4 : 3,
              fill: "hsl(var(--card))",
              stroke: "hsl(var(--primary))",
              strokeWidth: 2,
            }}
            activeDot={{
              r: size >= 300 ? 5 : 4,
              fill: "hsl(var(--primary))",
              stroke: "hsl(var(--card))",
              strokeWidth: 2,
            }}
          />
        </RadarChart>
      </ChartContainer>

      {showCenterScore && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-card"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            minWidth: 48,
            minHeight: 48,
          }}
        >
          <span
            className="font-semibold tabular-nums text-primary"
            style={{ fontSize: size >= 300 ? 28 : 22, lineHeight: 1 }}
          >
            {overall}
          </span>
          <span
            className="font-medium tracking-[0.12em] text-muted-foreground"
            style={{ fontSize: size >= 300 ? 8 : 7.5, marginTop: 2 }}
          >
            OVERALL
          </span>
        </div>
      )}
    </div>
  )
}
