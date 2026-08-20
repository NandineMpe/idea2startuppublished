/**
 * The scheduling arithmetic, checked against cases that matter.
 *
 * This is the half of Brand maxing that gives advice, and it gives it with
 * total confidence, so it has to be right. The case that matters most is the
 * peel booked too close to a shoot: getting that wrong does not produce a
 * vague answer, it produces a confident booking that costs a shoot day.
 *
 * Run with: npx tsx scripts/creator-check-brand-readiness.ts
 */
import {
  annualSpend,
  assessProtocol,
  daysBetween,
  parseDateOnly,
  type ProtocolInput,
} from "../lib/creator/brand/readiness"
import { PROTOCOL_SEEDS } from "../lib/creator/brand/protocols"

let pass = 0
let fail = 0

function check(name: string, got: unknown, want: unknown) {
  const ok = got === want
  if (ok) pass++
  else fail++
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `\n         got ${String(got)}, want ${String(want)}`}`)
}

const NOW = new Date("2026-08-20T09:00:00Z")

function seedInput(key: string, lastDone: string | null): ProtocolInput {
  const s = PROTOCOL_SEEDS.find((p) => p.key === key)!
  return {
    protocol_key: s.key,
    label: s.label,
    lead_days_before_camera: s.lead_days_before_camera,
    peak_days_after: s.peak_days_after,
    repeat_weeks: s.repeat_weeks,
    last_done_at: lastDone,
  }
}

function shoot(days: number): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return d
}

console.log("\nThe peel, which is the one that costs a shoot")
// Superficial peel needs 8 clear days.
check(
  "peel with shoot in 3 days is too late",
  assessProtocol(seedInput("peel_superficial", null), shoot(3), NOW).verdict,
  "too_late",
)
check(
  "peel with shoot in 7 days is still too late",
  assessProtocol(seedInput("peel_superficial", null), shoot(7), NOW).verdict,
  "too_late",
)
check(
  "peel with shoot in 8 days clears",
  assessProtocol(seedInput("peel_superficial", null), shoot(8), NOW).verdict,
  "book_now",
)
check(
  "peel with shoot tomorrow is too late",
  assessProtocol(seedInput("peel_superficial", null), shoot(1), NOW).verdict,
  "too_late",
)

console.log("\nThe wrinkle relaxer, the longest lead time on the list")
check(
  "relaxer with shoot in 13 days is too late",
  assessProtocol(seedInput("wrinkle_relaxer", null), shoot(13), NOW).verdict,
  "too_late",
)
check(
  "relaxer with shoot in 14 days clears",
  assessProtocol(seedInput("wrinkle_relaxer", null), shoot(14), NOW).verdict,
  "book_now",
)

console.log("\nLymphatic drainage, which is a day-before treatment and nothing else")
check(
  "drainage with shoot in 1 day is the window",
  assessProtocol(seedInput("lymphatic_drainage", null), shoot(1), NOW).verdict,
  "day_before",
)
check(
  "drainage with shoot in 2 days is still the window",
  assessProtocol(seedInput("lymphatic_drainage", null), shoot(2), NOW).verdict,
  "day_before",
)
check(
  "drainage with shoot in 10 days says hold, not book",
  assessProtocol(seedInput("lymphatic_drainage", null), shoot(10), NOW).verdict,
  "not_due",
)

console.log("\nCadence, independent of any shoot")
// Haircut repeats every 4 weeks = 28 days.
check(
  "haircut done 10 days ago with a distant shoot needs nothing",
  assessProtocol(seedInput("haircut", "2026-08-10"), shoot(30), NOW).verdict,
  "scheduled_fine",
)
check(
  "haircut done 30 days ago is due",
  assessProtocol(seedInput("haircut", "2026-07-21"), shoot(30), NOW).verdict,
  "book_now",
)
check(
  "haircut never recorded counts as due",
  assessProtocol(seedInput("haircut", null), shoot(30), NOW).verdict,
  "book_now",
)

console.log("\nA due treatment that is also too late loses to too late")
// Brow lamination needs 2 days and repeats every 7 weeks.
check(
  "overdue lamination with shoot tomorrow still reports too late",
  assessProtocol(seedInput("brow_lamination", "2026-05-01"), shoot(1), NOW).verdict,
  "too_late",
)

console.log("\nNo shoot date set")
check(
  "cadence still works without a shoot date",
  assessProtocol(seedInput("haircut", "2026-07-21"), null, NOW).verdict,
  "book_now",
)
check(
  "past shoot date is reported, not silently used",
  assessProtocol(seedInput("haircut", "2026-07-21"), shoot(-2), NOW).verdict,
  "no_shoot_date",
)

console.log("\nCalendar days, and date-only strings read as local dates")
check(
  "late evening to next morning is one calendar day",
  daysBetween(new Date(2026, 7, 20, 23, 0), new Date(2026, 7, 21, 1, 0)),
  1,
)
check(
  "two hours inside the same day is zero",
  daysBetween(new Date(2026, 7, 20, 9, 0), new Date(2026, 7, 20, 23, 0)),
  0,
)
// The bug this guards: new Date("2026-08-20") is UTC midnight, which is the
// 19th anywhere west of UTC, so every lead time would be a day short there.
check(
  "a date-only string is the day it says, in local time",
  parseDateOnly("2026-08-20").getDate(),
  20,
)
check("and the right month", parseDateOnly("2026-08-20").getMonth(), 7)

console.log("\nSpend never treats an unpriced item as free")
const spend = annualSpend([
  { protocol_key: "haircut", last_paid: 40, repeat_weeks: 4, active: true },
  { protocol_key: "brow_lamination", last_paid: null, repeat_weeks: 7, active: true },
  { protocol_key: "peel_superficial", last_paid: 100, repeat_weeks: 5, active: false },
])
check("haircut at 40 every 4 weeks is 520 a year", spend.total, 520)
check("the unpriced one is counted as unknown", spend.unknown, 1)
check("inactive treatments are excluded", spend.total, 520)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
