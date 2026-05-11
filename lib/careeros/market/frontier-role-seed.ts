/**
 * Curated frontier title clusters (MVP). Each cluster maps to one TheirStack
 * `job_title_or` query (count mode) to avoid OR-inflated totals.
 */
export type FrontierRoleClusterSeed = {
  slug: string
  /** UI label */
  canonicalTitle: string
  /** Near-duplicate titles for copy only; search uses {@link theirstackQueryTitle}. */
  aliases: string[]
  /** Single string passed to TheirStack job_title_or (first element). */
  theirstackQueryTitle: string
  /** O*NET major group prefixes (2 digits) this cluster is meant to sit near. */
  onetMajorPrefixes: string[]
  /** Optional canonical skill keys; if set, user must match prefix or overlap at least one. */
  skillHints?: string[]
}

export const FRONTIER_ROLE_CLUSTERS: FrontierRoleClusterSeed[] = [
  {
    slug: "ai-solutions-architect",
    canonicalTitle: "AI Solutions Architect",
    aliases: ["Solutions Architect AI", "AI/Cloud Solutions Architect"],
    theirstackQueryTitle: "AI Solutions Architect",
    onetMajorPrefixes: ["15", "11"],
    skillHints: ["ai-llm", "cloud-architecture"],
  },
  {
    slug: "ml-platform-engineer",
    canonicalTitle: "ML Platform Engineer",
    aliases: ["Machine Learning Platform Engineer", "ML Platform"],
    theirstackQueryTitle: "ML Platform Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["machine-learning", "kubernetes", "data-engineering"],
  },
  {
    slug: "forward-deployed-engineer",
    canonicalTitle: "Forward Deployed Engineer",
    aliases: ["Forward-Deployed Engineer", "FDE"],
    theirstackQueryTitle: "Forward Deployed Engineer",
    onetMajorPrefixes: ["15", "11"],
    skillHints: ["typescript", "python", "sql"],
  },
  {
    slug: "ai-engineer",
    canonicalTitle: "AI Engineer",
    aliases: ["AI/ML Engineer", "Applied AI Engineer"],
    theirstackQueryTitle: "AI Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["ai-llm", "machine-learning"],
  },
  {
    slug: "llm-engineer",
    canonicalTitle: "LLM Engineer",
    aliases: ["Large Language Model Engineer", "GenAI Engineer"],
    theirstackQueryTitle: "LLM Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["ai-llm"],
  },
  {
    slug: "prompt-engineer",
    canonicalTitle: "Prompt Engineer",
    aliases: ["AI Prompt Engineer", "LLM Prompt Engineer"],
    theirstackQueryTitle: "Prompt Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["ai-llm"],
  },
  {
    slug: "mlops-engineer",
    canonicalTitle: "MLOps Engineer",
    aliases: ["ML Ops Engineer", "Machine Learning Operations Engineer"],
    theirstackQueryTitle: "MLOps Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["machine-learning", "kubernetes", "cloud-architecture"],
  },
  {
    slug: "ai-safety-engineer",
    canonicalTitle: "AI Safety Engineer",
    aliases: ["AI Safety Research Engineer", "Responsible AI Engineer"],
    theirstackQueryTitle: "AI Safety Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["ai-llm", "machine-learning"],
  },
  {
    slug: "staff-ai-engineer",
    canonicalTitle: "Staff AI Engineer",
    aliases: ["Staff Machine Learning Engineer", "Principal AI Engineer"],
    theirstackQueryTitle: "Staff AI Engineer",
    onetMajorPrefixes: ["15"],
    skillHints: ["ai-llm", "machine-learning"],
  },
  {
    slug: "ai-product-manager",
    canonicalTitle: "AI Product Manager",
    aliases: ["Product Manager AI", "PM Machine Learning"],
    theirstackQueryTitle: "AI Product Manager",
    onetMajorPrefixes: ["11", "15"],
    skillHints: ["product-strategy", "ai-llm"],
  },
]
