export type WorkspaceContextStatus = "draft" | "intake_started" | "ready"

export interface WorkspaceSummary {
  id: string
  slug: string
  displayName: string
  contactName: string | null
  contactEmail: string | null
  companyName: string | null
  contextStatus: WorkspaceContextStatus
  lastContextSubmittedAt: string | null
  createdAt: string
  updatedAt: string
  intakePath: string
}
