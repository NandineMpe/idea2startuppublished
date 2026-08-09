import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { PRIMARY_ADAPTERS } from "@/lib/creator/research/primary"
import { EXTENDED_ADAPTERS } from "@/lib/creator/research/primary-extended"
import type { RawFeedItem } from "@/lib/careeros/sources/feed-types"

/**
 * Check a thread: what happened to this since it was reported?
 *
 * The searches are dated from the thread's anchor rather than from today, which
 * is the whole difference between this and the daily sweep. The sweep asks what
 * moved in the last 72 hours. This asks what has moved in the fourteen months
 * since the creator last talked about it, which is a question nobody else's
 * tooling is pointed at, because the news cycle has no mechanism for going back.
 *
 * Only primary lanes are used. Coverage is a snapshot and does not update: a
 * news article about a lawsuit says what was true the day it was written and
 * will say that forever. A docket has new filings on it. That difference is
 * what makes resurfacing checkable rather than a matter of memory.
 *
 * The hardest requirement is the honest null. A pass that always finds movement
 * is worse than useless, because the creator would go on camera and say
 * something developed when it did not. "Nothing has moved" has to be a
 * first-class, comfortable answer.
 */

export const THREAD_CHECK_PROMPT_VERSION = "creator-threads-check-v1"

/** Lanes worth checking for movement. Job ads and model releases do not develop. */
const CHECK_LANES = [
  "courts",
  "regulation",
  "filings",
  "inspections",
  "consultations",
  "standards",
  "supervisors",
  "scholarship",
  "retractions",
  "patents",
  "funding",
] as const

const checkSchema = z.object({
  moved: z
    .boolean()
    .describe("True only if a documented development happened AFTER the anchor date. A source restating the original story is not movement."),
  summary: z
    .string()
    .describe("What has actually changed since, in two or three sentences. If nothing has, say what you checked and what is still outstanding."),
  significance: z
    .enum(["major", "notable", "minor", "none"])
    .describe("major = the outcome landed, or the story reversed. notable = a real step. minor = procedural. none = nothing moved."),
  receipt_indexes: z
    .string()
    .describe("Indexes from the numbered source list that evidence the development, ONE PER LINE as bare numbers. Empty if nothing moved."),
  receipt_quotes: z
    .string()
    .describe("The specific fact, date, figure or holding from each cited source, ONE PER LINE, same order as receipt_indexes."),
  still_open: z
    .string()
    .describe("What is still unresolved, ONE PER LINE. These become the questions for the next check."),
  angle: z
    .string()
    .describe("If this moved and is worth a post, the angle, leading with the fact that the creator covered it first. Empty string if it did not move."),
})

const SYSTEM_PROMPT = `You are checking an open file. Something was reported on a date, the creator covered it, and everyone moved on. Your job is to find out what has happened to it SINCE, using only the documents provided.

You are given: what was known at the time, what would count as movement, and sources published after that date.

Rules:
- "moved" is true only for a documented development dated AFTER the anchor date. An article rehashing the original event is not movement, however recent it is. A source that merely mentions the subject in passing is not movement.
- Nothing moving is a completely acceptable and useful answer. Say so plainly, name what you checked, and set significance to none. Never manufacture a development to have something to report. A creator who goes on camera claiming something progressed when it did not loses more than a quiet week costs them.
- Distinguish a procedural step from an outcome. A scheduling order is minor. A ruling, a sanction, a final rule, a withdrawal, a settlement or a reversal is major.
- Receipts must be concrete and drawn from the numbered sources: a date, a holding, a figure, a named party, a docket number. Never invent one.
- If the sources suggest the original reporting was WRONG, or that it turned out smaller or larger than it looked, that is the most valuable finding available. Say it explicitly.
- The angle should lead on WHAT CHANGED and what it now means, not on the creator having been early. Having covered it before is why they can explain the shape of it, and that is worth using: what they said then, what actually happened, and what that tells you. It is not worth claiming. Never write an angle whose point is that other people did not go back. Only write one if it genuinely moved.`

function toLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*–]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
}

export type ThreadRow = {
  id: string
  subject: string
  query: string
  anchor_date: string
  what_was_known: string
  open_questions: string[]
  developments: unknown[]
  check_count: number
}

export type ThreadCheckResult =
  | { ok: true; moved: boolean; significance: string; receipts: number; sources: number; tokens: number }
  | { ok: false; error: string }

/** How long to wait before looking again, by what the last check found. */
function nextCheckDays(significance: string, checkCount: number): number {
  if (significance === "major") return 30
  if (significance === "notable") return 21
  // Nothing moving repeatedly is itself information: back off rather than
  // burning a search every fortnight on a file that has gone quiet.
  return Math.min(14 * Math.max(1, checkCount), 120)
}

export async function checkThread(
  supabase: SupabaseClient,
  userId: string,
  thread: ThreadRow,
): Promise<ThreadCheckResult> {
  const anchor = new Date(thread.anchor_date)
  const hoursSinceAnchor = Math.max(24, (Date.now() - anchor.getTime()) / 3600000)

  const all = { ...PRIMARY_ADAPTERS, ...EXTENDED_ADAPTERS }
  const results = await Promise.all(
    CHECK_LANES.map(async (lane) => {
      try {
        const items = await all[lane](thread.query, hoursSinceAnchor)
        return items.map((i) => ({ ...i, lane }))
      } catch {
        return [] as Array<RawFeedItem & { lane: string }>
      }
    }),
  )

  // Only what is genuinely newer than the anchor. An adapter with a wide
  // floor will happily return the original coverage, and the pass would then
  // report the thing the creator already said as a new development.
  const sources = results
    .flat()
    .filter((i) => i.published_at > anchor)
    .sort((a, b) => b.published_at.getTime() - a.published_at.getTime())
    .slice(0, 40)

  if (!sources.length) {
    await recordCheck(supabase, userId, thread, {
      moved: false,
      summary: "No primary document published since has anything on this. Checked courts, regulators, filings, standards and the literature.",
      significance: "none",
      receipts: [],
      still_open: thread.open_questions,
      angle: "",
    })
    return { ok: true, moved: false, significance: "none", receipts: 0, sources: 0, tokens: 0 }
  }

  const sourceList = sources
    .map(
      (s, i) =>
        `[${i}] lane=${s.lane} (${s.published_at.toISOString().slice(0, 10)}) ${s.title} <${s.url}>\n     ${(s.body ?? "").slice(0, 400)}`,
    )
    .join("\n")

  try {
    const { object, usage } = await creatorGenerateObject({
      schema: checkSchema,
      system: SYSTEM_PROMPT,
      prompt: `SUBJECT: ${thread.subject}

REPORTED ON: ${anchor.toISOString().slice(0, 10)} (${Math.round(hoursSinceAnchor / 24)} days ago)

WHAT WAS KNOWN THEN:
${thread.what_was_known}

WHAT WOULD COUNT AS MOVEMENT:
${thread.open_questions.map((q) => `- ${q}`).join("\n") || "- any documented development"}

PRIMARY SOURCES PUBLISHED SINCE (numbered):
${sourceList}

Has this moved?`,
      // Generous, because the honest-null answer is the LONG one: explaining
      // which of forty keyword matches were false positives takes more words
      // than reporting a development. At 8000 the Moonshot check ran out
      // mid-object and surfaced as a schema mismatch rather than as truncation.
      agent: "threads.check",
      log: { supabase, userId },
      maxOutputTokens: 16000,
    })

    const indexes = toLines(object.receipt_indexes)
      .map((n) => Number.parseInt(n, 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < sources.length)
    const quotes = toLines(object.receipt_quotes)

    const receipts = indexes.map((idx, i) => ({
      title: sources[idx].title,
      url: sources[idx].url,
      published_at: sources[idx].published_at.toISOString(),
      lane: sources[idx].lane,
      quote: quotes[i] ?? "",
    }))

    // A development with no receipt is an assertion. Downgrade rather than file
    // it, so the Desk never carries a claim the creator cannot stand behind.
    const moved = object.moved && receipts.length > 0
    const significance = moved ? object.significance : "none"

    await recordCheck(supabase, userId, thread, {
      moved,
      summary: object.summary,
      significance,
      receipts,
      still_open: toLines(object.still_open),
      angle: moved ? object.angle : "",
    })

    return {
      ok: true,
      moved,
      significance,
      receipts: receipts.length,
      sources: sources.length,
      tokens: usage.totalTokens,
    }
  } catch (e) {
    // Push the next check out even on failure. Leaving next_check_at in the
    // past means a thread that fails deterministically is picked up first by
    // every subsequent run and starves the rest of the queue behind it.
    const retryAt = new Date(Date.now() + 3 * 86400000).toISOString()
    await supabase
      .schema("creator")
      .from("creator_threads")
      .update({ next_check_at: retryAt, last_checked_at: new Date().toISOString() })
      .eq("id", thread.id)
      .eq("user_id", userId)

    return { ok: false, error: e instanceof Error ? e.message : "Could not check the thread." }
  }
}

type Development = {
  moved: boolean
  summary: string
  significance: string
  receipts: Array<{ title: string; url: string | null; published_at: string; lane: string; quote: string }>
  still_open: string[]
  angle: string
}

async function recordCheck(
  supabase: SupabaseClient,
  userId: string,
  thread: ThreadRow,
  dev: Development,
): Promise<void> {
  const now = new Date()
  const checkCount = thread.check_count + 1

  const developments = [
    ...(Array.isArray(thread.developments) ? thread.developments : []),
    { checked_at: now.toISOString(), ...dev },
  ]

  await supabase
    .schema("creator")
    .from("creator_threads")
    .update({
      developments,
      state: dev.moved ? "moved" : checkCount >= 4 ? "dormant" : "watching",
      last_checked_at: now.toISOString(),
      check_count: checkCount,
      next_check_at: new Date(
        now.getTime() + nextCheckDays(dev.significance, checkCount) * 86400000,
      ).toISOString(),
      open_questions: dev.still_open.length ? dev.still_open : thread.open_questions,
    })
    .eq("id", thread.id)
    .eq("user_id", userId)

  // Only a real development reaches the Desk. Minor procedural movement is
  // recorded on the thread and left there, because a Desk full of scheduling
  // orders trains the creator to stop reading it.
  if (dev.moved && (dev.significance === "major" || dev.significance === "notable")) {
    const { data: workRow } = await supabase
      .schema("creator")
      .from("creator_work")
      .insert({
        user_id: userId,
        kind: "insight",
        state: "proposed",
        autonomy: "approve",
        title: `Update: ${thread.subject}`,
        body: `${dev.angle}\n\nWhat changed: ${dev.summary}`,
        rationale: `You covered this on ${new Date(thread.anchor_date).toISOString().slice(0, 10)}, so you can say what you expected and what actually happened.`,
        provenance: {
          agent: "researcher (resurfaced)",
          canon_version: 0,
          source_post_ids: [],
          thread_id: thread.id,
          significance: dev.significance,
          evidence_urls: dev.receipts.map((r) => r.url).filter(Boolean),
          model_version: CREATOR_MODEL_VERSION,
          prompt_version: THREAD_CHECK_PROMPT_VERSION,
        },
      })
      .select("id")
      .single()

    if (workRow) {
      await supabase
        .schema("creator")
        .from("creator_threads")
        .update({ work_item_id: workRow.id })
        .eq("id", thread.id)
        .eq("user_id", userId)
    }
  }
}

/** Threads due a look, oldest anchor first. */
export async function loadDueThreads(
  supabase: SupabaseClient,
  userId: string,
  limit = 6,
): Promise<ThreadRow[]> {
  const { data } = await supabase
    .schema("creator")
    .from("creator_threads")
    .select("id,subject,query,anchor_date,what_was_known,open_questions,developments,check_count")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("state", ["watching", "moved"])
    .lte("next_check_at", new Date().toISOString())
    .order("anchor_date", { ascending: true })
    .limit(limit)

  return (data ?? []) as ThreadRow[]
}
