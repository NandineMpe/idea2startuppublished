export type AgentRole =
  | "ceo"
  | "cto"
  | "cmo"
  | "cfo"
  | "engineer"
  | "designer"
  | "pm"
  | "qa"
  | "devops"
  | "researcher"
  | "general"

/** UI-only status for executive role pages */
export type AgentStatus = "active" | "paused" | "terminated"

export type RoleSlug = "cbs" | "cro" | "cmo" | "cfo" | "coo"

export interface RoleConfig {
  slug: RoleSlug
  title: string
  shortTitle: string
  agentName: string
  role: AgentRole
  capabilities: string
  budgetMonthlyCents: number
  color: string
  bgColor: string
  responsibilities: {
    title: string
    href: string
    description: string
  }[]
}
