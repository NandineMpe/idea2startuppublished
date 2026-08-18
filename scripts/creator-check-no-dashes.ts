/**
 * Exercises the dash stripper against the shapes that actually turn up in a
 * drafted brand reply. Run with: npx tsx scripts/creator-check-no-dashes.ts
 */
import { withoutDashes } from "../lib/creator/no-dashes"

const cases: Array<[string, string]> = [
  ["The rate is 950 — that is the floor.", "The rate is 950. That is the floor."],
  ["My band is USD 950–4,275 per video.", "My band is USD 950 to 4,275 per video."],
  ["Warm, direct — no hype — and specific.", "Warm, direct, no hype, and specific."],
  ["Hi Sam,\n— one video\n— two cutdowns\nThanks.", "Hi Sam,\n- one video\n- two cutdowns\nThanks."],
  ["Nothing to change here at all.", "Nothing to change here at all."],
  ["State-of-the-art–level work.", "State-of-the-art-level work."],
  [
    "Happy to help — send the brief when ready. I will reply — fast.",
    "Happy to help. Send the brief when ready. I will reply. Fast.",
  ],
  ["Perpetual usage — all channels, forever — is +$1,900.", "Perpetual usage, all channels, forever, is +$1,900."],
]

let failed = 0
for (const [input, expected] of cases) {
  const actual = withoutDashes(input)
  const clean = !/[—–]/.test(actual)
  const ok = actual === expected && clean
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${JSON.stringify(input)}`)
  if (!ok) {
    console.log(`      expected ${JSON.stringify(expected)}`)
    console.log(`      actual   ${JSON.stringify(actual)}  clean=${clean}`)
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
