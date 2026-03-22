import { junoPing } from "./ping"
import { dailyBriefOrchestrator, dailyBriefRun } from "./cbs/daily-brief"
import { contentEngine } from "./cmo/content-engine"
import { jobBoardScanner, leadEnrichment, outreachDraft } from "./cro/job-pipeline"

/** All Inngest functions registered by `app/api/inngest/route.ts`. */
export const inngestFunctions = [
  junoPing,
  dailyBriefOrchestrator,
  dailyBriefRun,
  contentEngine,
  jobBoardScanner,
  leadEnrichment,
  outreachDraft,
]
