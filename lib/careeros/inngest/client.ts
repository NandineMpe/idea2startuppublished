import { Inngest } from "inngest"

// CareerOS event-type contract. Every event name must start with "careeros/".
type CareerOSEvents = {
  "careeros/system.ping": {
    data: { source: string; timestamp: string }
  }
  "careeros/cache.refresh": {
    data: { onetKeywords?: string[] }
  }
  "careeros/profile.extract": {
    data: {
      user_id: string
      onboarding_completion_id: string
    }
  }
  "careeros/profile.onet-map": {
    data: { user_id: string }
  }
  "careeros/skills.embed": {
    data: { user_id: string }
  }
  "careeros/market.refresh-demand": {
    data: {
      soc_codes?: string[]
      region_codes?: string[]
      offset?: number
      max_combos?: number
    }
  }
  "careeros/market.refresh-salary": {
    data: {
      soc_codes?: string[]
      region_codes?: string[]
      offset?: number
      max_combos?: number
    }
  }
  "careeros/market.refresh-skill-velocity": {
    data: {
      region_codes?: string[]
      window_codes?: string[]
    }
  }
  "careeros/market.refresh-adjacent-roles": {
    data: {
      source_soc_codes?: string[]
      top_k?: number
    }
  }
  "careeros/feed.ingest": {
    data: {
      hours_back?: number
    }
  }
  "careeros/feed.enrich-item": {
    data: {
      source_item_id: string
    }
  }
  "careeros/feed.personalise-for-all-users": {
    data: {
      enriched_item_id: string
    }
  }
  "careeros/feed.personalise-for-user": {
    data: {
      user_id: string
      enriched_item_id: string
    }
  }
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
