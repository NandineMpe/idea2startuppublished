import { Inngest } from "inngest"

// CareerOS event-type contract. Every event name must start with "careeros/".
type CareerOSEvents = {
  "careeros/system.ping": {
    data: { source: string; timestamp: string }
  }
  "careeros/cache.refresh": {
    data: { onetKeywords?: string[] }
  }
  // Phase 1 events will be added here as modules land:
  // "careeros/profile.extract": { data: { userId: string; documentId: string } };
  // "careeros/profile.onet-map": { data: { userId: string } };
}

export const careerosInngest = new Inngest({
  id: "careeros",
  eventKey: process.env.INNGEST_EVENT_KEY,
})

type CareerOSEventName = keyof CareerOSEvents

type CareerOSEventPayload<TName extends CareerOSEventName> = {
  name: TName
  data: CareerOSEvents[TName]["data"]
}

/**
 * Typed send helper that enforces the `careeros/*` event contract.
 * Use this over `careerosInngest.send()` in CareerOS code.
 */
export function sendCareerOSEvent<TName extends CareerOSEventName>(
  event: CareerOSEventPayload<TName>
) {
  return careerosInngest.send(event)
}
