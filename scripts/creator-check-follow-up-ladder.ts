/**
 * The gate that decides when a chaser is due.
 *
 * Worth testing rather than eyeballing: every rule here is a rule about not
 * emailing someone, and the failure mode is silent. A gate that is too loose
 * chases a brand three days after it already replied.
 *
 * Run with: npx tsx scripts/creator-check-follow-up-ladder.ts
 */
import {
  daysSilent,
  followUpDue,
  followUpsSent,
  MAX_FOLLOW_UPS,
  type ConversationMessage,
  type ConversationState,
  type CreatorConversation,
} from "../lib/creator/deals/conversations"

const NOW = Date.parse("2026-08-18T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

function conversation(opts: {
  state?: ConversationState
  sentDaysAgo?: number | null
  lastContactDaysAgo?: number | null
  followUps?: Array<{ sent: boolean }>
}): CreatorConversation {
  const messages: ConversationMessage[] = [
    {
      seq: 1,
      kind: "reply",
      body: "reply",
      drafted_at: daysAgo(opts.sentDaysAgo ?? 0),
      sent_at: opts.sentDaysAgo == null ? null : daysAgo(opts.sentDaysAgo),
    },
    ...(opts.followUps ?? []).map((f, i) => ({
      seq: i + 2,
      kind: "follow_up" as const,
      body: "chase",
      drafted_at: daysAgo(1),
      sent_at: f.sent ? daysAgo(1) : null,
    })),
  ]

  return {
    id: "id",
    brand: "Brand",
    inbound: "brief",
    what_they_want: "a video",
    deliverables: [],
    quoted_total: 950,
    currency: "USD",
    messages,
    state: opts.state ?? "open",
    sent_at: opts.sentDaysAgo == null ? null : daysAgo(opts.sentDaysAgo),
    last_contact_at:
      opts.lastContactDaysAgo === undefined
        ? opts.sentDaysAgo == null
          ? null
          : daysAgo(opts.sentDaysAgo)
        : opts.lastContactDaysAgo === null
          ? null
          : daysAgo(opts.lastContactDaysAgo),
    created_at: daysAgo(30),
  }
}

const cases: Array<[string, boolean]> = [
  ["nothing sent yet, never due", followUpDue(conversation({ sentDaysAgo: null }), NOW) === false],
  ["sent today, not due", followUpDue(conversation({ sentDaysAgo: 0 }), NOW) === false],
  ["2 days silent, not yet due", followUpDue(conversation({ sentDaysAgo: 2 }), NOW) === false],
  ["3 days silent, first chase due", followUpDue(conversation({ sentDaysAgo: 3 }), NOW) === true],
  [
    "they replied, never due however long the silence",
    followUpDue(conversation({ sentDaysAgo: 60, state: "replied" }), NOW) === false,
  ],
  ["won, never due", followUpDue(conversation({ sentDaysAgo: 60, state: "won" }), NOW) === false],
  ["lost, never due", followUpDue(conversation({ sentDaysAgo: 60, state: "lost" }), NOW) === false],
  [
    "one chase sent, 4 days silent, second not yet due",
    followUpDue(
      conversation({ sentDaysAgo: 20, lastContactDaysAgo: 4, followUps: [{ sent: true }] }),
      NOW,
    ) === false,
  ],
  [
    "one chase sent, 10 days silent, second due",
    followUpDue(
      conversation({ sentDaysAgo: 30, lastContactDaysAgo: 10, followUps: [{ sent: true }] }),
      NOW,
    ) === true,
  ],
  [
    "two chases sent, 21 days silent, breakup due",
    followUpDue(
      conversation({
        sentDaysAgo: 60,
        lastContactDaysAgo: 21,
        followUps: [{ sent: true }, { sent: true }],
      }),
      NOW,
    ) === true,
  ],
  [
    "three chases sent, ladder exhausted, never due again",
    followUpDue(
      conversation({
        sentDaysAgo: 90,
        lastContactDaysAgo: 60,
        followUps: [{ sent: true }, { sent: true }, { sent: true }],
      }),
      NOW,
    ) === false,
  ],
  [
    "a drafted but unsent chase does not advance the ladder",
    followUpsSent(conversation({ sentDaysAgo: 10, followUps: [{ sent: false }] })) === 0,
  ],
  [
    "silence is measured from last contact, not from the first email",
    daysSilent(conversation({ sentDaysAgo: 40, lastContactDaysAgo: 5 }), NOW) === 5,
  ],
  ["the ladder is three rungs", MAX_FOLLOW_UPS === 3],
]

let failed = 0
for (const [name, ok] of cases) {
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
