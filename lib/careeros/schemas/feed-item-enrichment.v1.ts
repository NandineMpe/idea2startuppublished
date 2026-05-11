import { z } from "zod"

export const FeedItemEnrichmentSchema = z.object({
  enriched_summary: z.string().min(50).max(500),
  entity_type: z.enum([
    "model_release",
    "research_finding",
    "product_launch",
    "policy",
    "industry_news",
  ]),
  entities: z.object({
    models: z.array(z.string()).default([]),
    companies: z.array(z.string()).default([]),
    capabilities: z.array(z.string()).default([]),
  }),
  affected_functions: z.array(z.string()).default([]),
  affected_skills: z.array(z.string()).default([]),
  affected_seniority_levels: z
    .array(z.enum(["entry", "junior", "mid", "senior", "staff", "principal", "exec"]))
    .default([]),
  significance_score: z.number().min(0).max(1),
})

export const FEED_ENRICHMENT_SCHEMA_VERSION = 1
