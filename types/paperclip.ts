export type AgentRole = "ceo" | "cto" | "cmo" | "cfo" | "engineer" | "designer" | "pm" | "qa" | "devops" | "researcher" | "general"

export type AgentStatus = "active" | "paused" | "terminated"

export type AdapterType =
  | "claude_local"
  | "codex_local"
  | "cursor"
  | "opencode_local"
  | "hermes_local"
  | "process"
  | "http"
  | "bash"

export interface Agent {
  id: string
  name: string
  role: AgentRole
  title: string
  capabilities: string
  status: AgentStatus
  adapterType: AdapterType
  adapterConfig: Record<string, unknown>
  runtimeConfig?: Record<string, unknown>
  budgetMonthlyCents: number
  budgetUsedCents: number
  reportsTo: string | null
  companyId: string
  createdAt: string
  updatedAt: string
}

export interface Company {
  id: string
  name: string
  mission: string
  status: string
  budgetMonthlyCents: number
  createdAt: string
}

export interface Issue {
  id: string
  title: string
  description: string
  status: "open" | "in_progress" | "closed"
  assignedAgentId: string | null
  companyId: string
  projectId?: string
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  title: string
  description: string
  status: "active" | "completed" | "blocked"
  companyId: string
  parentGoalId?: string
  createdAt: string
}

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
