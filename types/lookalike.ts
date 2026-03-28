/**
 * Lookalike engine — Layer 1 structured profile (7 dimensions + playbook + stats).
 */

export type SeniorityMin = "director" | "vp" | "c_level" | "partner" | ""

export interface PersonTitleDimension {
  weight: number
  matchTerms: string[]
  excludeTerms: string[]
  seniorityMin: SeniorityMin
}

export interface PersonFunctionDimension {
  weight: number
  functions: string[]
  excludeFunctions: string[]
}

export interface CompanyTypeDimension {
  weight: number
  types: string[]
  excludeTypes: string[]
}

export interface CompanySizeDimension {
  weight: number
  minEmployees: number | null
  maxEmployees: number | null
  ranges: string[]
}

export interface GeographyDimension {
  weight: number
  countries: string[]
  cities: string[]
  regions: string[]
}

export interface IndustryContextDimension {
  weight: number
  industries: string[]
  subVerticals: string[]
}

export interface MultiplierEffectDimension {
  weight: number
  isMultiplier: boolean
  multiplierType: string | null
  estimatedReach: number | null
}

export interface LookalikeDimensions {
  personTitle: PersonTitleDimension
  personFunction: PersonFunctionDimension
  companyType: CompanyTypeDimension
  companySize: CompanySizeDimension
  geography: GeographyDimension
  industryContext: IndustryContextDimension
  multiplierEffect: MultiplierEffectDimension
}

export interface OutreachPlaybook {
  bestChannel: string
  bestDayOfWeek: string | null
  bestAngle: string
  averageResponseTime: string | null
  /** Why this ICP / conversion pattern works — feeds personalization */
  rationale: string
  messageTemplate: {
    linkedin: string
    email: string
  }
}

export interface LookalikeStats {
  totalGenerated: number
  totalContacted: number
  replies: number
  meetings: number
  closed: number
  replyRate: number | null
  meetingRate: number | null
  conversionRate: number | null
  outcomeCountAtLastRefine: number
}

export interface LookalikeProfileRow {
  id: string
  userId: string
  name: string
  createdFromConversionId: string | null
  segmentTag: string | null
  dimensions: LookalikeDimensions
  outreachPlaybook: OutreachPlaybook
  stats: LookalikeStats
  queriesCache: PlatformQuery[] | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PlatformId =
  | "linkedin_sales_nav"
  | "apollo"
  | "linkedin_boolean"
  | "apollo_api"

export interface PlatformQuery {
  platform: PlatformId
  query: string
  url: string | null
  estimatedResults: string
}

export type OutreachOutcomeType =
  | "contacted"
  | "no_response"
  | "replied"
  | "meeting"
  | "closed_won"
  | "closed_lost"
  | "not_icp"

export interface OutreachOutcomeAttributes {
  title: string
  company: string
  companyType: string
  companySize: string
  geography: string
  industry: string
}
