import { mkdir, writeFile } from "fs/promises"
import { join } from "path"
import {
  adaptiveThreshold,
  classifyItemFunction,
  deriveFunctionProfile,
  evaluatePolicyGate,
  resolveUserSegment,
  type FeedUserSeniority,
} from "../lib/careeros/feed/policy"

type Persona = {
  id: string
  roleTitle: string
  onetSocCode: string | null
  skills: string[]
  seniority: FeedUserSeniority
}

type Candidate = {
  title: string
  summary: string
  affectedFunctions: string[]
  affectedSkills: string[]
  significance: number
  relevance: number
  overlap: number
  labelRelevant: boolean
}

const PERSONAS: Persona[] = [
  {
    id: "backend-mid",
    roleTitle: "Backend Engineer",
    onetSocCode: "15-1252.00",
    skills: ["typescript", "api-design", "kubernetes", "python"],
    seniority: "mid",
  },
  {
    id: "data-senior",
    roleTitle: "Senior Data Scientist",
    onetSocCode: "15-2051.00",
    skills: ["machine-learning", "sql", "python", "ai-llm"],
    seniority: "senior",
  },
  {
    id: "pm-mid",
    roleTitle: "Product Manager",
    onetSocCode: null,
    skills: ["roadmap", "experimentation", "product-analytics"],
    seniority: "mid",
  },
  {
    id: "designer-junior",
    roleTitle: "Product Designer",
    onetSocCode: "17-2112.00",
    skills: ["figma", "interaction-design", "user-research"],
    seniority: "junior",
  },
  {
    id: "security-staff",
    roleTitle: "Staff Security Engineer",
    onetSocCode: null,
    skills: ["threat-modeling", "owasp", "incident-response"],
    seniority: "staff",
  },
]

const CANDIDATES: Candidate[] = [
  {
    title: "Type-safe API agents for backend orchestration",
    summary: "New SDK patterns for robust API integrations with retries and observability.",
    affectedFunctions: ["software-engineering", "product-management"],
    affectedSkills: ["typescript", "api-design", "ai-agents"],
    significance: 0.72,
    relevance: 0.69,
    overlap: 0.52,
    labelRelevant: true,
  },
  {
    title: "Design system motion trends for 2026",
    summary: "UI animation and interaction design ideas for consumer apps.",
    affectedFunctions: ["design"],
    affectedSkills: ["visual-design", "interaction-design"],
    significance: 0.64,
    relevance: 0.61,
    overlap: 0.12,
    labelRelevant: false,
  },
  {
    title: "Secure model gateway threat surface review",
    summary: "Prompt-injection and secrets-exfiltration risk patterns in LLM gateways.",
    affectedFunctions: ["security", "software-engineering"],
    affectedSkills: ["cybersecurity", "api-design", "ai-llm"],
    significance: 0.83,
    relevance: 0.73,
    overlap: 0.58,
    labelRelevant: true,
  },
  {
    title: "Go-to-market messaging refresh guide",
    summary: "Brand positioning and messaging strategy for product launches.",
    affectedFunctions: ["design", "product-management"],
    affectedSkills: ["brand-design", "product-strategy"],
    significance: 0.49,
    relevance: 0.56,
    overlap: 0.2,
    labelRelevant: false,
  },
  {
    title: "AI observability for production services",
    summary: "Operational playbook for tracing model regressions and latency shifts.",
    affectedFunctions: ["software-engineering", "operations", "data-ai"],
    affectedSkills: ["python", "api-design", "data-engineering"],
    significance: 0.77,
    relevance: 0.67,
    overlap: 0.44,
    labelRelevant: true,
  },
  {
    title: "Security controls for MCP tools",
    summary: "Least-privilege and audit guidance for tool-enabled AI workflows.",
    affectedFunctions: ["security", "software-engineering"],
    affectedSkills: ["cybersecurity", "api-design"],
    significance: 0.81,
    relevance: 0.7,
    overlap: 0.41,
    labelRelevant: true,
  },
]

const ALARMIST_LANGUAGE = /(panic|catastrophic|inevitable job loss|crisis|devastating|guaranteed disruption)/i

async function main() {
  const diagnostics = []
  let globalPass = true

  for (const persona of PERSONAS) {
    const profile = deriveFunctionProfile({
      currentRoleTitle: persona.roleTitle,
      onetSocCode: persona.onetSocCode,
      skills: persona.skills,
    })
    const segment = resolveUserSegment(profile.primary_family, persona.seniority)
    const threshold = adaptiveThreshold({
      segment,
      engagement: { open_rate_30d: 0.46, dismiss_rate_30d: 0.17, save_rate_30d: 0.05 },
    })
    let tp = 0
    let fp = 0
    let predictedRelevant = 0
    let simulatedWeeklyCount = 0
    const simulatedNotes: string[] = []
    for (const c of CANDIDATES) {
      const itemFn = classifyItemFunction({
        affectedFunctions: c.affectedFunctions,
        title: c.title,
        summary: c.summary,
        affectedSkills: c.affectedSkills,
      })
      const decision = evaluatePolicyGate({
        relevanceScore: c.relevance,
        adaptiveThreshold: threshold,
        currentWeeklyDelivered: simulatedWeeklyCount,
        functionProfile: profile,
        itemFunction: itemFn,
        significance: c.significance,
        overlapScore: c.overlap,
      })
      const predicted = decision.allow
      if (predicted) {
        predictedRelevant += 1
        simulatedWeeklyCount += 1
        simulatedNotes.push(`Evidence-based update for ${persona.roleTitle}: ${c.title}.`)
      }
      if (predicted && c.labelRelevant) tp += 1
      if (predicted && !c.labelRelevant) fp += 1
    }

    const precision = predictedRelevant > 0 ? Number((tp / predictedRelevant).toFixed(3)) : 0
    const irrelevanceFalsePositiveRate = Number((fp / CANDIDATES.filter((c) => !c.labelRelevant).length).toFixed(3))
    const toneViolations = simulatedNotes.filter((note) => ALARMIST_LANGUAGE.test(note)).length
    const weeklyBandPass = simulatedWeeklyCount >= 3 && simulatedWeeklyCount <= 5
    const personaPass = precision >= 0.75 && irrelevanceFalsePositiveRate <= 0.2 && toneViolations === 0
    if (!personaPass || !weeklyBandPass) globalPass = false
    diagnostics.push({
      persona_id: persona.id,
      role_family: profile.primary_family,
      segment,
      adaptive_threshold: threshold,
      relevance_precision: precision,
      irrelevance_false_positive_rate: irrelevanceFalsePositiveRate,
      tone_violations: toneViolations,
      weekly_item_count: simulatedWeeklyCount,
      weekly_item_count_band_pass: weeklyBandPass,
      pass: personaPass && weeklyBandPass,
    })
  }

  const summary = {
    generated_at: new Date().toISOString(),
    pass: globalPass,
    checks: {
      relevance_precision_min: 0.75,
      irrelevance_false_positive_rate_max: 0.2,
      tone_alarmist_violations_max: 0,
      weekly_item_count_target_band: [3, 5],
    },
    personas: diagnostics,
  }

  const outDir = join(process.cwd(), "tmp")
  await mkdir(outDir, { recursive: true })
  const outPath = join(outDir, "careeros-feed-persona-verification.json")
  await writeFile(outPath, JSON.stringify(summary, null, 2), "utf8")
  console.log(JSON.stringify({ output_file: outPath, ...summary }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
