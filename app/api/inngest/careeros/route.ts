import { serve } from "inngest/next"
import { careerosInngest } from "@/lib/careeros/inngest/client"
import { marketCacheRefresh } from "@/lib/careeros/inngest/functions/market-cache-refresh"
import { marketRefreshDemand } from "@/lib/careeros/inngest/functions/market-refresh-demand"
import { marketRefreshAdjacentRoles } from "@/lib/careeros/inngest/functions/market-refresh-adjacent-roles"
import { marketRefreshSalary } from "@/lib/careeros/inngest/functions/market-refresh-salary"
import { marketRefreshSkillVelocity } from "@/lib/careeros/inngest/functions/market-refresh-skill-velocity"
import { profileExtract } from "@/lib/careeros/inngest/functions/profile-extract"
import { profileOnetMap } from "@/lib/careeros/inngest/functions/profile-onet-map"
import { skillsEmbed } from "@/lib/careeros/inngest/functions/skills-embed"
import { systemPing } from "@/lib/careeros/inngest/functions/system-ping"
import { feedIngest } from "@/lib/careeros/inngest/functions/feed-ingest"
import { feedEnrichItem } from "@/lib/careeros/inngest/functions/feed-enrich-item"
import {
  feedPersonaliseForAllUsers,
  feedPersonaliseForUser,
} from "@/lib/careeros/inngest/functions/feed-personalise"
import { skillsComputeHalfLife } from "@/lib/careeros/inngest/functions/skills-compute-half-life"
import { exposureScoreRefresh } from "@/lib/careeros/inngest/functions/exposure-score-refresh"

export const runtime = "nodejs"
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: careerosInngest,
  functions: [
    systemPing,
    marketCacheRefresh,
    marketRefreshDemand,
    marketRefreshAdjacentRoles,
    marketRefreshSalary,
    marketRefreshSkillVelocity,
    profileExtract,
    profileOnetMap,
    skillsEmbed,
    feedIngest,
    feedEnrichItem,
    feedPersonaliseForAllUsers,
    feedPersonaliseForUser,
    skillsComputeHalfLife,
    exposureScoreRefresh,
  ],
})
