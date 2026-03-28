import type { RoleConfig } from "@/types/agent-roles"

export const ROLE_CONFIGS: Record<string, RoleConfig> = {
  cbs: {
    slug: "cbs",
    title: "Chief Business Strategist",
    shortTitle: "CBS",
    agentName: "strategy-lead",
    role: "ceo",
    capabilities:
      "Business strategy, idea validation, value proposition design, business model innovation, opportunity assessment",
    budgetMonthlyCents: 5000,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    responsibilities: [
      {
        title: "Business Idea Analysis",
        href: "/dashboard/idea/analyser",
        description: "Validate your startup idea with AI-driven market intelligence.",
      },
      {
        title: "Value proposition workflow",
        href: "/dashboard/idea/value-proposition",
        description: "Run a structured pass to sharpen how you resonate with your audience — you edit and ship.",
      },
      {
        title: "Business model workflow",
        href: "/dashboard/idea/business-model",
        description: "Walk through and refine your model — canvas-style output you can act on.",
      },
      {
        title: "Business Opportunity Scanner",
        href: "/dashboard/market/opportunity-scanner",
        description: "Discover and evaluate new business opportunities.",
      },
    ],
  },
  cro: {
    slug: "cro",
    title: "Chief Research Officer",
    shortTitle: "CRO",
    agentName: "research-lead",
    role: "researcher",
    capabilities:
      "Market research, consumer insights, competitor intelligence, domain expertise, feedback analysis, trend identification",
    budgetMonthlyCents: 4000,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    responsibilities: [
      {
        title: "Consumer & Market Insights",
        href: "/dashboard/idea/market-insights",
        description: "Deep dive into consumer behavior and market dynamics.",
      },
      {
        title: "Competitor Analysis",
        href: "/dashboard/idea/competitor-analysis",
        description: "Analyze your competitive landscape.",
      },
      {
        title: "Advanced Competition Analyzer",
        href: "/dashboard/scale/competition",
        description: "Deep competitive intelligence with SWOT and positioning.",
      },
      {
        title: "Domain Knowledge",
        href: "/dashboard/knowledge/domain",
        description: "Build and leverage your domain expertise.",
      },
      {
        title: "Feedback & Insights",
        href: "/dashboard/knowledge/feedback",
        description: "Collect and analyze user feedback.",
      },
    ],
  },
  cmo: {
    slug: "cmo",
    title: "Chief Marketing Officer",
    shortTitle: "CMO",
    agentName: "marketing-lead",
    role: "cmo",
    capabilities:
      "Go-to-market strategy, pitch creation, brand storytelling, founder narrative, event strategy, international marketing",
    budgetMonthlyCents: 4000,
    color: "text-rose-500",
    bgColor: "bg-rose-50",
    responsibilities: [
      {
        title: "Go-To-Market Strategy",
        href: "/dashboard/market/strategy",
        description: "Generate a comprehensive plan to launch and scale.",
      },
      { title: "Pitch Vault", href: "/dashboard/pitch", description: "Craft compelling pitches for investors, customers, and partners." },
      {
        title: "Founder's Journey",
        href: "/dashboard/knowledge/founders-journey",
        description: "Build your founder story and brand narrative.",
      },
      {
        title: "Global Startup Events",
        href: "/dashboard/scale/events",
        description: "Find conferences, accelerators, and networking opportunities.",
      },
      {
        title: "Internationalisation Strategy",
        href: "/dashboard/scale/international",
        description: "Expand your startup into global markets.",
      },
    ],
  },
  cfo: {
    slug: "cfo",
    title: "Chief Financial Officer",
    shortTitle: "CFO",
    agentName: "finance-lead",
    role: "cfo",
    capabilities:
      "Financial engineering, funding readiness, fundraising strategy, cap table management, startup credits, financial modeling",
    budgetMonthlyCents: 3000,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    responsibilities: [
      {
        title: "Financial Engineering",
        href: "/dashboard/scale/financial",
        description: "Build financial models and projections.",
      },
      {
        title: "Funding Readiness Score",
        href: "/dashboard/market/funding-score",
        description: "Assess how ready you are for fundraising.",
      },
      {
        title: "Funding Strategy Optimizer",
        href: "/dashboard/market/funding-strategy",
        description: "Optimize your fundraising approach.",
      },
      {
        title: "Cap Table Management",
        href: "/dashboard/scale/cap-table",
        description: "Manage equity and ownership structure.",
      },
      {
        title: "Startup Credits Database",
        href: "/dashboard/scale/credits",
        description: "Find startup credits and perks.",
      },
    ],
  },
  coo: {
    slug: "coo",
    title: "Chief Operating Officer",
    shortTitle: "COO",
    agentName: "operations-lead",
    role: "general",
    capabilities:
      "Operations management, legal compliance, LLC formation, recruiting, business planning, product roadmap execution",
    budgetMonthlyCents: 3000,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    responsibilities: [
      {
        title: "LLC Formation Service",
        href: "/dashboard/market/llc-formation",
        description: "Set up your legal entity.",
      },
      {
        title: "Startup Legal Requirements",
        href: "/dashboard/market/legal",
        description: "Navigate legal requirements for your startup.",
      },
      {
        title: "Recruiting Agent",
        href: "/dashboard/scale/recruiting",
        description: "Find and evaluate talent for your team.",
      },
      {
        title: "Full business plan workflow",
        href: "/dashboard/scale/business-plan",
        description: "Structured pass over your plan — edit sections and export what you will use.",
      },
      {
        title: "Product roadmap workflow",
        href: "/dashboard/idea/roadmap",
        description: "Phased milestones and metrics you can execute against — not a static chart.",
      },
    ],
  },
}

export const ROLE_ORDER: string[] = ["cbs", "cro", "cmo", "cfo", "coo"]
