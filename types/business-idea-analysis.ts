export interface BusinessIdeaAnalysis {
  summary: string
  strengths: string[]
  weaknesses: string[]
  opportunities: string[]
  threats: string[]
  marketPotential: {
    score: number
    explanation: string
  }
  feasibility: {
    score: number
    explanation: string
  }
  innovation: {
    score: number
    explanation: string
  }
  recommendation: string
  nextSteps: string[]
  potentialRevenues: string[]
  estimatedCosts: string[]
  targetAudience: string[]
}
