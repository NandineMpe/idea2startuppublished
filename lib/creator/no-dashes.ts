/**
 * Strip em and en dashes from anything the creator is expected to send.
 *
 * She will not send an email containing one, so a drafted reply with an em dash
 * in it is not a draft, it is homework. The system prompts ask for this too, but
 * a prompt is a request and this is a guarantee: the model will comply for
 * twenty emails and then slip one in on the twenty-first, which is exactly the
 * one that goes out without being reread.
 *
 * Applied to outbound copy only. Nothing here touches source quotes, extracts or
 * evidence, where altering the punctuation would mean altering what someone
 * actually wrote.
 *
 * Literal regex throughout rather than RegExp built from template strings: the
 * escaping in the string form is one backslash away from silently compiling to
 * a pattern that matches almost nothing, and it fails quietly rather than loudly.
 */

const HAS_EM = /—/

/**
 * Paired dashes are parenthetical, so they become commas. A lone dash separates
 * clauses, so it becomes a full stop and the next word is capitalised, which is
 * the one substitution that cannot produce a comma splice.
 */
function fixSentence(sentence: string): string {
  const count = (sentence.match(/—/g) ?? []).length
  if (count === 0) return sentence

  if (count >= 2) {
    // "warm, direct — no hype — and specific" -> "warm, direct, no hype, and specific"
    return sentence.replace(/\s*—\s*/g, ", ").replace(/,\s*,/g, ",")
  }

  return sentence.replace(/\s*—\s*(.)/, (_m, next: string) => `. ${next.toUpperCase()}`)
}

export function withoutDashes(text: string): string {
  if (!text) return text

  let out = text
    // Numeric ranges read as ranges, not as broken sentences: 950–2,000 -> 950 to 2,000.
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1 to $2")
    // A dash opening a line is a bullet, so it becomes one.
    .replace(/(^|\n)[ \t]*[–—][ \t]*/g, "$1- ")
    // Every remaining en dash is doing a hyphen's job.
    .replace(/–/g, "-")

  if (!HAS_EM.test(out)) return out

  // Split on sentence ends so pairing is judged within a sentence rather than
  // across a whole email, where two unrelated lone dashes would look like a pair.
  out = out
    .split(/(?<=[.!?])(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : fixSentence(part)))
    .join("")

  // Anything left is a dash in a position the rules above did not reach, such as
  // one that opens or closes the string. Dropping it beats shipping it.
  return out.replace(/\s*—\s*/g, " ").replace(/[ \t]{2,}/g, " ")
}
