/**
 * Em dash removal.
 *
 * The creator does not want them anywhere, and least of all in outbound email,
 * where the spaced em dash is one of the more recognisable tells that a message
 * was machine-drafted. A prompt instruction alone leaks: models reach for the
 * em dash constantly and one survivor in a pitch is one too many. So the rule is
 * stated in the prompt AND enforced here, and this function is the guarantee.
 */

const EM_OR_EN = /[—–―]/

/**
 * Replace em and en dashes with punctuation that reads naturally.
 *
 * A comma covers the parenthetical and appositive positions an em dash usually
 * occupies. The exception is a numeric range, where the dash is doing arithmetic
 * rather than punctuation: "USD 452—2,436" must become "452-2,436", never
 * "452, 2,436", which would read as two separate figures and misquote a rate.
 */
export function withoutEmDashes(text: string): string {
  if (!text || !EM_OR_EN.test(text)) return text

  return (
    text
      // Numeric ranges keep a hyphen. Runs first so the comma rule cannot claim them.
      .replace(/(\d)\s*[—–―]\s*(\d)/g, "$1-$2")
      // A leading dash is a list bullet, not punctuation.
      .replace(/^\s*[—–―]\s*/gm, "")
      // Everything else becomes a comma.
      .replace(/\s*[—–―]\s*/g, ", ")
      // Tidy the artefacts the substitution can create.
      .replace(/,\s*([.,!?;:])/g, "$1")
      .replace(/([([])\s*,\s*/g, "$1")
      .replace(/\s+([.,!?;:])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  )
}

/** Apply to every string in an object, one level deep, leaving other types alone. */
export function stripEmDashesDeep<T>(value: T): T {
  if (typeof value === "string") return withoutEmDashes(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => stripEmDashesDeep(v)) as unknown as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripEmDashesDeep(v)
    }
    return out as T
  }
  return value
}

/** Prompt-side rule, so the model writes prose that does not need repairing. */
export const NO_EM_DASH_RULE =
  "Never use an em dash or en dash. Not in prose, not in email, not in lists. Use a comma, a full stop, a colon or brackets instead, and use a hyphen only inside a numeric range. This is absolute: a single em dash in an outbound email marks it as machine-written."
