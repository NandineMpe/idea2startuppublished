import { serve } from "inngest/next"
import { creatorInngest } from "@/lib/creator/inngest/client"
import { creatorSystemPing } from "@/lib/creator/inngest/functions/system-ping"
import { creatorResearchSweep } from "@/lib/creator/inngest/functions/research-sweep"
import { creatorResearchSynthesise } from "@/lib/creator/inngest/functions/research-synthesise"
import { creatorStoryLineage } from "@/lib/creator/inngest/functions/story-lineage"
import { creatorOpportunitiesSweep } from "@/lib/creator/inngest/functions/opportunities-sweep"
import { creatorCorpusIngested } from "@/lib/creator/inngest/functions/corpus-ingested"
import { creatorContentTranscribe } from "@/lib/creator/inngest/functions/content-transcribe"
import { creatorContentEnrich } from "@/lib/creator/inngest/functions/content-enrich"
import { creatorMetricsRefresh } from "@/lib/creator/inngest/functions/metrics-refresh"
import { creatorCanonDerive } from "@/lib/creator/inngest/functions/canon-derive"
import { creatorWriterDraft } from "@/lib/creator/inngest/functions/writer-draft"

export const runtime = "nodejs"
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: creatorInngest,
  functions: [
    creatorSystemPing,
    creatorResearchSweep,
    creatorResearchSynthesise,
    creatorStoryLineage,
    creatorOpportunitiesSweep,
    creatorCorpusIngested,
    creatorContentEnrich,
    creatorMetricsRefresh,
    creatorContentTranscribe,
    creatorCanonDerive,
    creatorWriterDraft,
  ],
})
