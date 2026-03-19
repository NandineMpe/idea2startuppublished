/**
 * Seed script to create the Idea to Startup company and its 5 executive agents
 * in Paperclip via the REST API.
 *
 * Usage: npx tsx scripts/seed-agents.ts
 *
 * Requires Paperclip to be running at http://localhost:3100
 */

const PAPERCLIP_URL = process.env.PAPERCLIP_URL || "http://localhost:3100"

interface AgentSeed {
  name: string
  role: string
  title: string
  capabilities: string
  adapterType: string
  adapterConfig: Record<string, unknown>
  budgetMonthlyCents: number
}

const agents: AgentSeed[] = [
  {
    name: "strategy-lead",
    role: "ceo",
    title: "Chief Business Strategist",
    capabilities: "Business strategy, idea validation, value proposition design, business model innovation, opportunity assessment",
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
    budgetMonthlyCents: 5000,
  },
  {
    name: "research-lead",
    role: "researcher",
    title: "Chief Research Officer",
    capabilities: "Market research, consumer insights, competitor intelligence, domain expertise, feedback analysis, trend identification",
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
    budgetMonthlyCents: 4000,
  },
  {
    name: "marketing-lead",
    role: "cmo",
    title: "Chief Marketing Officer",
    capabilities: "Go-to-market strategy, pitch creation, brand storytelling, founder narrative, event strategy, international marketing",
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
    budgetMonthlyCents: 4000,
  },
  {
    name: "finance-lead",
    role: "cfo",
    title: "Chief Financial Officer",
    capabilities: "Financial engineering, funding readiness, fundraising strategy, cap table management, startup credits, financial modeling",
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
    budgetMonthlyCents: 3000,
  },
  {
    name: "operations-lead",
    role: "general",
    title: "Chief Operating Officer",
    capabilities: "Operations management, legal compliance, LLC formation, recruiting, business planning, product roadmap execution",
    adapterType: "claude_local",
    adapterConfig: { model: "claude-sonnet-4-20250514", maxTokens: 8192 },
    budgetMonthlyCents: 3000,
  },
]

async function main() {
  console.log("Connecting to Paperclip at", PAPERCLIP_URL)

  // 1. Create company
  console.log("\nCreating company: Idea to Startup...")
  const companyRes = await fetch(`${PAPERCLIP_URL}/api/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Idea to Startup",
      mission: "Help founders turn ideas into fundable, scalable startups",
      budgetMonthlyCents: 19000,
    }),
  })

  if (!companyRes.ok) {
    const err = await companyRes.text()
    console.error("Failed to create company:", companyRes.status, err)
    process.exit(1)
  }

  const company = await companyRes.json()
  console.log("Company created:", company.id)

  // 2. Create agents
  const createdAgents: Array<{ id: string; name: string; title: string }> = []

  for (const agent of agents) {
    console.log(`\nCreating agent: ${agent.title}...`)
    const agentRes = await fetch(`${PAPERCLIP_URL}/api/companies/${company.id}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...agent,
        reportsTo: null, // all report to board (you)
      }),
    })

    if (!agentRes.ok) {
      const err = await agentRes.text()
      console.error(`Failed to create ${agent.title}:`, agentRes.status, err)
      continue
    }

    const created = await agentRes.json()
    createdAgents.push({ id: created.id, name: created.name, title: agent.title })
    console.log(`  Created: ${created.id}`)
  }

  console.log("\n--- Seed Complete ---")
  console.log(`Company: ${company.id} (${company.name})`)
  console.log("Agents:")
  createdAgents.forEach((a) => {
    console.log(`  ${a.title}: ${a.id}`)
  })
  console.log("\nYour executive team is ready!")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
