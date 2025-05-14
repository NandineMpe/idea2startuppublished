export interface AnalysisSection {
  title: string
  content: string
}

export interface AnalysisResponse {
  sections: AnalysisSection[]
}

export interface BusinessIdeaInput {
  ideaDescription: string
  proposedSolution?: string
  intendedUsers?: string
  geographicFocus?: string
}
