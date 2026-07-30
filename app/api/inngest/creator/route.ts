import { serve } from "inngest/next"
import { creatorInngest } from "@/lib/creator/inngest/client"
import { creatorSystemPing } from "@/lib/creator/inngest/functions/system-ping"
import { creatorResearchSweep } from "@/lib/creator/inngest/functions/research-sweep"
import { creatorResearchSynthesise } from "@/lib/creator/inngest/functions/research-synthesise"
import { creatorOpportunitiesSweep } from "@/lib/creator/inngest/functions/opportunities-sweep"
import { creatorCorpusIngested } from "@/lib/creator/inngest/functions/corpus-ingested"
import { creatorContentTranscribe } from "@/lib/creator/inngest/functions/content-transcribe"
import { creatorContentEnrich } from "@/lib/creator/inngest/functions/content-enrich"
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
    creatorOpportunitiesSweep,
    creatorCorpusIngested,
    creatorContentEnrich,
    creatorContentTranscribe,
    creatorCanonDerive,
    creatorWriterDraft,
  ],
})
