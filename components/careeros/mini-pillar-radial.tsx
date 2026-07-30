import { PillarRadarChart, type PillarRadarPillar } from "@/components/careeros/pillar-radar-chart"

/** Dashboard rail spider chart (Recharts radar). */
export function MiniPillarRadial({
  pillars,
  overall,
  size = 240,
}: {
  pillars: PillarRadarPillar[]
  overall: number
  size?: number
}) {
  return <PillarRadarChart pillars={pillars} overall={overall} size={size} />
}
