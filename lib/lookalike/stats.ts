import type { LookalikeStats, OutreachOutcomeType } from "@/types/lookalike"
import { DEFAULT_STATS } from "./defaults"

export function recomputeDerivedRates(stats: LookalikeStats): LookalikeStats {
  const c = stats.totalContacted
  const r = stats.replies
  const m = stats.meetings
  const cl = stats.closed
  return {
    ...stats,
    replyRate: c > 0 ? Math.round((r / c) * 1000) / 1000 : null,
    meetingRate: c > 0 ? Math.round((m / c) * 1000) / 1000 : null,
    conversionRate: c > 0 ? Math.round((cl / c) * 1000) / 1000 : null,
  }
}

export function applyOutcomeToStats(
  stats: LookalikeStats,
  outcome: OutreachOutcomeType,
): LookalikeStats {
  const next = { ...stats }
  switch (outcome) {
    case "contacted":
      next.totalContacted += 1
      break
    case "no_response":
      break
    case "replied":
      next.replies += 1
      break
    case "meeting":
      next.meetings += 1
      break
    case "closed_won":
    case "closed_lost":
      next.closed += 1
      break
    case "not_icp":
      break
    default:
      break
  }
  return recomputeDerivedRates(next)
}

export function initialStatsRow(): LookalikeStats {
  return { ...DEFAULT_STATS }
}
