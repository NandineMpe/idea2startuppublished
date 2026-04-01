// ─── Juno Agent Functions ────────────────────────────────────────
// All Inngest functions exported from one place.
// Import this in app/api/inngest/route.ts
// ──────────────────────────────────────────────────────────────────

// CBS — Chief Business Strategist
export { dailyBrief, dailyBriefFanOut } from "./cbs-daily-brief"
export { cbsCeoReview, cbsCeoReviewFanOut } from "./cbs-ceo-review"

// CRO — Chief Research Officer
export { jobBoardScanner, jobScanFanOut, leadOutreach } from "./cro-lead-pipeline"
export { gtmMotion } from "./gtm-motion"
export { intentScanFanOut, intentScanner } from "./cro/intent-scanner"

// CMO — Chief Marketing Officer
export { commentEngine, contentEngine, relationshipTracker } from "./cmo-content-engine"

// CTO — Chief Technology Officer
export { platformPoster, techRadar } from "./cto-tech-radar"
export { securityScan, securityScanFanOut } from "./cto-security-scan"

// Staff meeting (synthesis across agents)
export { staffMeetingFanOut, staffMeeting } from "./staff-meeting"

export { junoPing } from "./ping"
export { contextVaultSync, contextVaultSyncFanOut } from "./context-vault-sync"

import { commentEngine, contentEngine, relationshipTracker } from "./cmo-content-engine"
import { dailyBrief, dailyBriefFanOut } from "./cbs-daily-brief"
import { cbsCeoReview, cbsCeoReviewFanOut } from "./cbs-ceo-review"
import { contextVaultSync, contextVaultSyncFanOut } from "./context-vault-sync"
import { jobBoardScanner, jobScanFanOut, leadOutreach } from "./cro-lead-pipeline"
import { gtmMotion } from "./gtm-motion"
import { intentScanFanOut, intentScanner } from "./cro/intent-scanner"
import { platformPoster, techRadar } from "./cto-tech-radar"
import { securityScan, securityScanFanOut } from "./cto-security-scan"
import { staffMeetingFanOut, staffMeeting } from "./staff-meeting"
import { junoPing } from "./ping"

/** All Inngest functions registered by `app/api/inngest/route.ts`. */
export const inngestFunctions = [
  junoPing,
  contextVaultSyncFanOut,
  contextVaultSync,
  dailyBriefFanOut,
  dailyBrief,
  cbsCeoReviewFanOut,
  cbsCeoReview,
  contentEngine,
  commentEngine,
  relationshipTracker,
  techRadar,
  platformPoster,
  securityScanFanOut,
  securityScan,
  jobScanFanOut,
  jobBoardScanner,
  leadOutreach,
  gtmMotion,
  intentScanFanOut,
  intentScanner,
  staffMeetingFanOut,
  staffMeeting,
]
