import type { Agent, Company, Issue, Goal, RoleConfig } from "@/types/paperclip"

const PAPERCLIP_PROXY = "/api/paperclip"

async function paperclipFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${PAPERCLIP_PROXY}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    throw new Error(`Paperclip API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export async function getCompanies(): Promise<Company[]> {
  return paperclipFetch<Company[]>("/companies")
}

export async function createCompany(data: { name: string; mission: string; budgetMonthlyCents: number }): Promise<Company> {
  return paperclipFetch<Company>("/companies", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getAgents(companyId: string): Promise<Agent[]> {
  return paperclipFetch<Agent[]>(`/companies/${companyId}/agents`)
}

export async function createAgent(companyId: string, data: Partial<Agent>): Promise<Agent> {
  return paperclipFetch<Agent>(`/companies/${companyId}/agents`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getAgent(agentId: string): Promise<Agent> {
  return paperclipFetch<Agent>(`/agents/${agentId}`)
}

export async function updateAgent(agentId: string, data: Partial<Agent>): Promise<Agent> {
  return paperclipFetch<Agent>(`/agents/${agentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function pauseAgent(agentId: string): Promise<void> {
  await paperclipFetch(`/agents/${agentId}/pause`, { method: "POST" })
}

export async function resumeAgent(agentId: string): Promise<void> {
  await paperclipFetch(`/agents/${agentId}/resume`, { method: "POST" })
}

export async function terminateAgent(agentId: string): Promise<void> {
  await paperclipFetch(`/agents/${agentId}/terminate`, { method: "POST" })
}

export async function triggerHeartbeat(agentId: string): Promise<void> {
  await paperclipFetch(`/agents/${agentId}/heartbeat`, { method: "POST" })
}

export async function getIssues(companyId: string): Promise<Issue[]> {
  return paperclipFetch<Issue[]>(`/companies/${companyId}/issues`)
}

export async function getGoals(companyId: string): Promise<Goal[]> {
  return paperclipFetch<Goal[]>(`/companies/${companyId}/goals`)
}

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  cbs: {
    slug: "cbs",
    title: "Chief Business Strategist",
    shortTitle: "CBS",
    agentName: "strategy-lead",
    role: "ceo",
    capabilities: "Business strategy, idea validation, value proposition design, business model innovation, opportunity assessment",
    budgetMonthlyCents: 5000,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    responsibilities: [
      { title: "Business Idea Analysis", href: "/dashboard/idea/analyser", description: "Validate your startup idea with AI-driven market intelligence." },
      { title: "Value Proposition Generator", href: "/dashboard/idea/value-proposition", description: "Create compelling value propositions that resonate with your audience." },
      { title: "Business Model Generator", href: "/dashboard/idea/business-model", description: "Design and visualize your business model." },
      { title: "Business Opportunity Scanner", href: "/dashboard/market/opportunity-scanner", description: "Discover and evaluate new business opportunities." },
    ],
  },
  cro: {
    slug: "cro",
    title: "Chief Research Officer",
    shortTitle: "CRO",
    agentName: "research-lead",
    role: "researcher",
    capabilities: "Market research, consumer insights, competitor intelligence, domain expertise, feedback analysis, trend identification",
    budgetMonthlyCents: 4000,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    responsibilities: [
      { title: "Consumer & Market Insights", href: "/dashboard/idea/market-insights", description: "Deep dive into consumer behavior and market dynamics." },
      { title: "Competitor Analysis", href: "/dashboard/idea/competitor-analysis", description: "Analyze your competitive landscape." },
      { title: "Advanced Competition Analyzer", href: "/dashboard/scale/competition", description: "Advanced tools for competitive intelligence." },
      { title: "Domain Knowledge", href: "/dashboard/knowledge/domain", description: "Build and leverage your domain expertise." },
      { title: "Feedback & Insights", href: "/dashboard/knowledge/feedback", description: "Collect and analyze user feedback." },
    ],
  },
  cmo: {
    slug: "cmo",
    title: "Chief Marketing Officer",
    shortTitle: "CMO",
    agentName: "marketing-lead",
    role: "cmo",
    capabilities: "Go-to-market strategy, pitch creation, brand storytelling, founder narrative, event strategy, international marketing",
    budgetMonthlyCents: 4000,
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    responsibilities: [
      { title: "Go-To-Market Strategy", href: "/dashboard/market/strategy", description: "Generate a comprehensive plan to launch and scale." },
      { title: "Pitch Vault", href: "/dashboard/pitch", description: "Craft compelling pitches for investors, customers, and partners." },
      { title: "Founder's Journey", href: "/dashboard/knowledge/founders-journey", description: "Build your founder story and brand narrative." },
      { title: "Global Startup Events", href: "/dashboard/scale/events", description: "Discover startup events and networking opportunities worldwide." },
      { title: "Internationalisation Strategy", href: "/dashboard/scale/international", description: "Expand your startup into global markets." },
    ],
  },
  cfo: {
    slug: "cfo",
    title: "Chief Financial Officer",
    shortTitle: "CFO",
    agentName: "finance-lead",
    role: "cfo",
    capabilities: "Financial engineering, funding readiness, fundraising strategy, cap table management, startup credits, financial modeling",
    budgetMonthlyCents: 3000,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    responsibilities: [
      { title: "Financial Engineering", href: "/dashboard/scale/financial", description: "Build financial models and projections." },
      { title: "Funding Readiness Score", href: "/dashboard/market/funding-score", description: "Assess how ready you are for fundraising." },
      { title: "Funding Strategy Optimizer", href: "/dashboard/market/funding-strategy", description: "Optimize your fundraising approach." },
      { title: "Cap Table Management", href: "/dashboard/scale/cap-table", description: "Manage equity and ownership structure." },
      { title: "Startup Credits Database", href: "/dashboard/scale/credits", description: "Find startup credits and perks." },
    ],
  },
  coo: {
    slug: "coo",
    title: "Chief Operating Officer",
    shortTitle: "COO",
    agentName: "operations-lead",
    role: "general",
    capabilities: "Operations management, legal compliance, LLC formation, recruiting, business planning, product roadmap execution",
    budgetMonthlyCents: 3000,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    responsibilities: [
      { title: "LLC Formation Service", href: "/dashboard/market/llc-formation", description: "Set up your legal entity." },
      { title: "Startup Legal Requirements", href: "/dashboard/market/legal", description: "Navigate legal requirements for your startup." },
      { title: "Recruiting Agent", href: "/dashboard/scale/recruiting", description: "Find and evaluate talent for your team." },
      { title: "Full Business Plan", href: "/dashboard/scale/business-plan", description: "Generate a comprehensive business plan." },
      { title: "Product Roadmap Builder", href: "/dashboard/idea/roadmap", description: "Plan and visualize your product development." },
    ],
  },
}

export const ROLE_ORDER: string[] = ["cbs", "cro", "cmo", "cfo", "coo"]
