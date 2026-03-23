// ─── Juno Agent Functions ────────────────────────────────────────
// All Inngest functions exported from one place.
// Import this in app/api/inngest/route.ts
// ──────────────────────────────────────────────────────────────────

// CBS — Chief Business Strategist
export { dailyBrief, dailyBriefFanOut } from "./cbs-daily-brief"

// CRO — Chief Research Officer
export { jobBoardScanner, jobScanFanOut, leadOutreach } from "./cro-lead-pipeline"

// CMO — Chief Marketing Officer
export { commentEngine, contentEngine, relationshipTracker } from "./cmo-content-engine"

// CTO — Chief Technology Officer
export { platformPoster, techRadar } from "./cto-tech-radar"

// Staff meeting (synthesis across agents)
export { staffMeetingFanOut, staffMeeting } from "./staff-meeting"

export { junoPing } from "./ping"

import { commentEngine, contentEngine, relationshipTracker } from "./cmo-content-engine"
import { dailyBrief, dailyBriefFanOut } from "./cbs-daily-brief"
import { jobBoardScanner, jobScanFanOut, leadOutreach } from "./cro-lead-pipeline"
import { platformPoster, techRadar } from "./cto-tech-radar"
import { staffMeetingFanOut, staffMeeting } from "./staff-meeting"
import { junoPing } from "./ping"

/** All Inngest functions registered by `app/api/inngest/route.ts`. */
export const inngestFunctions = [
  junoPing,
  dailyBriefFanOut,
  dailyBrief,
  contentEngine,
  commentEngine,
  relationshipTracker,
  techRadar,
  platformPoster,
  jobScanFanOut,
  jobBoardScanner,
  leadOutreach,
  staffMeetingFanOut,
  staffMeeting,
]
