import { PROTOCOL_BY_KEY } from "./protocols"

/**
 * Working backwards from the shoot.
 *
 * This is the whole point of the screen. Given a shoot date and a register of
 * treatments with lead times, there is exactly one correct answer per treatment
 * and it is arithmetic, not advice:
 *
 *   - if it needs eight clear days and the shoot is in three, it is too late,
 *     and saying so is the most valuable thing this can do, because the peel
 *     booked in a panic on the Wednesday is what actually loses the Saturday
 *   - if it peaks a day after and lasts three, it belongs the day before, and
 *     doing it any earlier is money spent on nothing
 *   - if it is due on its own cadence and there is room before the shoot, book
 *     it now
 *
 * Deterministic on purpose, like the industry selection. Nothing here is a
 * model call and nothing needs to be.
 */

export type ProtocolState = {
  protocol_key: string
  label: string
  /** Whole days from now until the shoot. Null when no shoot date is set. */
  days_to_shoot: number | null
  /** Days since it was last done. Null when never recorded. */
  days_since: number | null
  /** True when its own cadence says it is due, regardless of any shoot. */
  due: boolean
  verdict: Verdict
  /** One line, already written for the card. */
  line: string
  /** The last date it can be booked and still clear its lead time. */
  latest_useful_date: string | null
}

export type Verdict =
  | "book_now"
  | "day_before"
  | "too_late"
  | "scheduled_fine"
  | "not_due"
  | "no_shoot_date"

export const VERDICT_LABEL: Record<Verdict, string> = {
  book_now: "Book now",
  day_before: "Day before",
  too_late: "Too late for this shoot",
  scheduled_fine: "Fine as it is",
  not_due: "Not due",
  no_shoot_date: "Set a shoot date",
}

/**
 * Treatments whose effect is short enough that they belong immediately before
 * the shoot rather than on a cadence.
 *
 * Identified by having no repeat cadence and a peak inside two days. Encoded as
 * a rule rather than a list so a treatment she adds herself gets the same
 * handling without anyone remembering to update a constant.
 */
function isDayBefore(leadDays: number, peakDays: number, repeatWeeks: number | null): boolean {
  return repeatWeeks === null && leadDays <= 1 && peakDays <= 2
}

/**
 * Parse a date-only string as a LOCAL date.
 *
 * `new Date("2026-08-10")` is specified to parse as UTC midnight, which in any
 * timezone behind UTC is the evening of the ninth. Every date on this screen is
 * a calendar date a person wrote down, a shoot day or the day she had her hair
 * cut, and none of them mean an instant. Left alone this shifts every lead time
 * by a day for anyone west of London, and a peel that needs eight clear days
 * would clear at seven.
 */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return new Date(value)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function daysBetween(from: Date, to: Date): number {
  // Calendar days in local time, not elapsed hours. A treatment on Monday
  // evening and a shoot on Tuesday morning is one day apart to anyone booking
  // it, and rounding by hours would call it zero and wave through a peel.
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime()
  // Rounded because a DST boundary between the two makes this 23 or 25 hours.
  return Math.round((b - a) / 86_400_000)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function isoDate(d: Date): string {
  // Local, for the same reason parseDateOnly is. toISOString would render a
  // local 1 September as 31 August for anyone east of UTC.
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${m}-${day}`
}

export type ProtocolInput = {
  protocol_key: string
  label: string
  lead_days_before_camera: number
  peak_days_after: number
  repeat_weeks: number | null
  last_done_at: string | null
}

export function assessProtocol(
  p: ProtocolInput,
  shootDate: Date | null,
  now: Date = new Date(),
): ProtocolState {
  const daysSince = p.last_done_at ? daysBetween(parseDateOnly(p.last_done_at), now) : null
  const cadenceDays = p.repeat_weeks ? p.repeat_weeks * 7 : null

  // Never done counts as due. The alternative is a register that stays silent
  // about everything she has not started, which is the opposite of the ask.
  const due = cadenceDays === null ? daysSince === null : daysSince === null || daysSince >= cadenceDays

  const dayBefore = isDayBefore(p.lead_days_before_camera, p.peak_days_after, p.repeat_weeks)

  if (!shootDate) {
    return {
      protocol_key: p.protocol_key,
      label: p.label,
      days_to_shoot: null,
      days_since: daysSince,
      due,
      verdict: due ? "book_now" : "no_shoot_date",
      line: due
        ? cadenceDays === null
          ? "No shoot date set. This one is timed to a shoot, so it waits until there is one."
          : daysSince === null
            ? "Never recorded. Add the last date you had it done and this starts tracking."
            : `Last done ${daysSince} days ago, cadence is ${p.repeat_weeks} weeks. Due.`
        : `Last done ${daysSince} days ago. Next due in about ${cadenceDays! - (daysSince ?? 0)} days.`,
      latest_useful_date: null,
    }
  }

  const daysToShoot = daysBetween(now, shootDate)
  // The last day it can be done and still clear its lead time.
  const latest = addDays(shootDate, -p.lead_days_before_camera)

  if (daysToShoot < 0) {
    return {
      protocol_key: p.protocol_key,
      label: p.label,
      days_to_shoot: daysToShoot,
      days_since: daysSince,
      due,
      verdict: "no_shoot_date",
      line: "That shoot date has passed. Set the next one.",
      latest_useful_date: null,
    }
  }

  if (dayBefore) {
    // The window is narrow by definition: too early and the effect is gone.
    const inWindow = daysToShoot <= 2
    return {
      protocol_key: p.protocol_key,
      label: p.label,
      days_to_shoot: daysToShoot,
      days_since: daysSince,
      due,
      verdict: inWindow ? "day_before" : "not_due",
      line: inWindow
        ? `Book this for the day before. The effect peaks about a day after and is gone within three, so this is the window.`
        : `Hold. The effect only lasts a couple of days, so this is worth booking around ${isoDate(addDays(shootDate, -1))} and not before.`,
      latest_useful_date: isoDate(addDays(shootDate, -1)),
    }
  }

  if (daysToShoot < p.lead_days_before_camera) {
    return {
      protocol_key: p.protocol_key,
      label: p.label,
      days_to_shoot: daysToShoot,
      days_since: daysSince,
      due,
      verdict: "too_late",
      line: `Needs ${p.lead_days_before_camera} clear days and the shoot is in ${daysToShoot}. Doing it now costs you the shoot rather than improving it. Book it for after.`,
      latest_useful_date: isoDate(latest),
    }
  }

  if (!due) {
    return {
      protocol_key: p.protocol_key,
      label: p.label,
      days_to_shoot: daysToShoot,
      days_since: daysSince,
      due,
      verdict: "scheduled_fine",
      line:
        daysSince === null
          ? "No date recorded yet."
          : `Done ${daysSince} days ago and not due again until about day ${cadenceDays}. Nothing to do before this shoot.`,
      latest_useful_date: isoDate(latest),
    }
  }

  return {
    protocol_key: p.protocol_key,
    label: p.label,
    days_to_shoot: daysToShoot,
    days_since: daysSince,
    due,
    verdict: "book_now",
    line: `Due, and there is room. Book any time up to ${isoDate(latest)} to clear the ${p.lead_days_before_camera} day lead time.`,
    latest_useful_date: isoDate(latest),
  }
}

/**
 * Ordering: what could still go wrong first.
 *
 * Too late leads, because it is the one that changes a decision she is about to
 * make. Fine-as-it-is sinks, because a register that opens with everything
 * already handled buries the two things that are not.
 */
const VERDICT_RANK: Record<Verdict, number> = {
  too_late: 0,
  book_now: 1,
  day_before: 2,
  no_shoot_date: 3,
  not_due: 4,
  scheduled_fine: 5,
}

export function sortByUrgency(states: ProtocolState[]): ProtocolState[] {
  return [...states].sort(
    (a, b) => VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] || a.label.localeCompare(b.label),
  )
}

/** Annual run rate from what she actually pays, not from the indicative ranges. */
export function annualSpend(
  rows: Array<{ protocol_key: string; last_paid: number | null; repeat_weeks: number | null; active: boolean }>,
): { total: number; unknown: number } {
  let total = 0
  let unknown = 0
  for (const r of rows) {
    if (!r.active) continue
    const seed = PROTOCOL_BY_KEY.get(r.protocol_key)
    const weeks = r.repeat_weeks ?? seed?.repeat_weeks ?? null
    // A one-off has no run rate, and a treatment with no recorded price is
    // counted as unknown rather than as zero. A total that silently treats
    // unpriced items as free is the kind of number that gets believed.
    if (!weeks) continue
    if (r.last_paid === null) {
      unknown++
      continue
    }
    total += Number(r.last_paid) * (52 / weeks)
  }
  return { total: Math.round(total), unknown }
}
