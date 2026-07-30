import { Inngest } from "inngest"

/**
 * Creator OS event-type contract. Every event name must start with "creator/".
 *
 * The events mirror the agency: corpus and canon are the shared ground truth,
 * research and opportunities are the two standing-remit agents, and each agent
 * both runs on a cron sweep and can be triggered on demand for one user.
 */
export type CreatorEvents = {
  "creator/system.ping": {
    data: { source: string; timestamp: string }
  }

  // Corpus: ingestion fans out to per-post transcription.
  "creator/corpus.ingested": {
    data: { user_id: string; content_ids: string[] }
  }
  "creator/content.enrich": {
    data: { user_id: string; content_id: string }
  }
  "creator/metrics.refresh": {
    data: { user_id?: string }
  }
  "creator/content.transcribe": {
    data: { user_id: string; content_id: string }
  }

  // Canon: derive (or re-derive) from the transcribed corpus.
  "creator/canon.derive": {
    data: { user_id: string }
  }

  // Researcher: sweep collects signals; synthesise connects dots into stories.
  "creator/research.sweep": {
    data: { user_id?: string; hours_back?: number }
  }
  "creator/research.synthesise": {
    data: { user_id: string }
  }
  "creator/story.lineage": {
    data: { user_id: string; story_id: string }
  }

  // Opportunities: deals, events and marketplace matches, each with a drafted pitch.
  "creator/opportunities.sweep": {
    data: { user_id?: string }
  }

  // Writer: draft a piece for an approved story or an explicit request.
  "creator/writer.draft": {
    data: { user_id: string; story_id?: string; brief?: string }
  }
}

export const creatorInngest = new Inngest({
  id: "creator",
  eventKey: process.env.INNGEST_EVENT_KEY,
})

type CreatorEventName = keyof CreatorEvents

type CreatorEventPayload<TName extends CreatorEventName> = {
  name: TName
  data: CreatorEvents[TName]["data"]
}

/**
 * Typed send helper that enforces the `creator/*` event contract.
 * Use this over `creatorInngest.send()` in Creator OS code.
 */
export function sendCreatorEvent<TName extends CreatorEventName>(
  event: CreatorEventPayload<TName>
) {
  return creatorInngest.send(event)
}
