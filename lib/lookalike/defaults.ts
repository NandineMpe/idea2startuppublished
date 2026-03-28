import type { LookalikeDimensions, LookalikeStats, OutreachPlaybook } from "@/types/lookalike"

export const DEFAULT_DIMENSION_WEIGHTS: LookalikeDimensions = {
  personTitle: {
    weight: 15,
    matchTerms: [],
    excludeTerms: [],
    seniorityMin: "",
  },
  personFunction: {
    weight: 15,
    functions: [],
    excludeFunctions: [],
  },
  companyType: {
    weight: 20,
    types: [],
    excludeTypes: [],
  },
  companySize: {
    weight: 10,
    minEmployees: null,
    maxEmployees: null,
    ranges: [],
  },
  geography: {
    weight: 15,
    countries: [],
    cities: [],
    regions: [],
  },
  industryContext: {
    weight: 15,
    industries: [],
    subVerticals: [],
  },
  multiplierEffect: {
    weight: 10,
    isMultiplier: false,
    multiplierType: null,
    estimatedReach: null,
  },
}

export const DEFAULT_STATS: LookalikeStats = {
  totalGenerated: 0,
  totalContacted: 0,
  replies: 0,
  meetings: 0,
  closed: 0,
  replyRate: null,
  meetingRate: null,
  conversionRate: null,
  outcomeCountAtLastRefine: 0,
}

export function emptyPlaybook(): OutreachPlaybook {
  return {
    bestChannel: "",
    bestDayOfWeek: null,
    bestAngle: "",
    averageResponseTime: null,
    rationale: "",
    messageTemplate: { linkedin: "", email: "" },
  }
}
