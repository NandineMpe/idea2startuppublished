import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { CREATOR_MODEL_VERSION, creatorGenerateObject } from "@/lib/creator/ai/claude"
import { loadTrajectory, trajectoryBlock } from "@/lib/creator/load-trajectory"

/**
 * Synthesis — turn raw signals into story dossiers.
 *
 * The uniqueness muscle lives here, in three enforced properties:
 *  1. Every story must be a synthesis KIND (connection / contradiction /
 *     second-order / trend break / own-content), never a restated headline.
 *  2. The editor gate: a story citing fewer than two distinct signals stays in
 *     'watchlist' and never reaches the Desk. Enforced in code, not the prompt.
 *  3. The candidate gate: named actor, stakes, one unknown, an open question, a
 *     practitioner-facing stance and a sayable hook. Failing any one kills the
 *     candidate outright rather than passing it on to be fixed downstream,
 *     because none of those holes is one a writer can fill later. A card that
 *     cannot fill them is a research brief, not a video.
 */

export const SYNTHESIS_PROMPT_VERSION = "creator-synthesise-v2"

const SIGNAL_WINDOW_HOURS = 72
const MAX_STORIES_PER_RUN = 8

/**
 * Per-lane quotas rather than one "newest N" query.
 *
 * Sorting all signals by date and taking the top N silently starves the lanes
 * that make this worth doing: arXiv carries submission dates and books carry
 * publication years, so both sort below this week's news and would never reach
 * the prompt. Quotas guarantee each register is represented, which is the
 * precondition for the cross-lane connections synthesis is asked to prefer.
 */
const LANE_QUOTAS: Record<string, number> = {
  // Primary. These hold the document itself, and they get the larger share
  // because a desk that wants to be first cannot be reading only coverage.
  papers: 14,
  filings: 10,
  courts: 10,
  regulation: 10,
  standards: 10,
  patents: 8,
  funding: 8,
  // First signal. Weighted with the strongest primary lanes, not below them:
  // the point of collecting them is that they arrive before anyone else has
  // written about the thing.
  ventures: 10,
  changelogs: 10,
  grants: 8,
  solicitations: 8,
  code: 8,
  models: 6,
  releases: 10,
  inspections: 10,
  consultations: 10,
  supervisors: 10,
  scholarship: 10,
  jobs: 8,
  syscards: 8,
  conferences: 6,
  procurement: 6,
  retractions: 6,
  // Secondary. Deliberately capped: news used to be the largest quota here, and
  // a slate assembled mostly from news is a slate every commentator in the
  // niche could have filed that week.
  news: 12,
  books: 6,
  discussion: 6,
}

/** Reserved for signals from the creator's declared territory, across every lane. */
const HORIZON_QUOTA = 20

const storySchema = z.object({
  thesis: z.string().describe("The unique claim, one or two sentences. Not a headline restated — a take that requires the cited signals together."),
  synthesis_kind: z.enum(["connection", "contradiction", "second_order", "trend_break", "own_content"]),
  move: z.enum(["consolidate", "expand", "advance"]).describe(
    "consolidate = deepens ground the creator already owns. expand = moves them into an adjacent topic. advance = builds the position they said they are moving toward.",
  ),
  signal_indexes: z.array(z.number().int()).describe("Indexes into the numbered signal list that this thesis stands on."),
  receipts: z.array(z.object({
    signal_index: z.number().int(),
    quote: z.string().describe("The specific fact/number/quote from that signal that supports the thesis."),
  })),
  why_now: z.string().describe("Why this week, not next month."),

  // The candidate gate, carried as fields rather than checked in prose. A
  // candidate that cannot fill these is a research brief, and nothing
  // downstream rescues it: the writer cannot invent stakes that the receipts do
  // not contain, and the visual planner cannot show a thing nobody did.
  named_actor: z
    .string()
    .describe(
      "Who DID something. A named person, company, court or regulator that took an action. A document is not an actor: 'the FRC published a report' is weak, 'PwC filed', 'the court compelled', 'Anthropic shipped' is strong. Empty string if no actor acted.",
    ),
  stakes: z
    .string()
    .describe(
      "Who loses, who is embarrassed, who has to change what they do, and by when. Must come from the receipts, not from speculation. Empty string if the receipts do not support it.",
    ),
  unknown_terms: z
    .string()
    .describe(
      "Every document, body, standard or concept in this thesis that a working professional outside the specialism would NOT already recognise, comma separated. Do not list things that are common knowledge. Empty string if none.",
    ),
  open_question: z
    .string()
    .describe(
      "A question this card genuinely cannot answer from its own receipts, which curiosity can run on. Not rhetorical. If everything here is already resolved, return an empty string.",
    ),
  hook_line: z
    .string()
    .describe(
      "One sentence, sayable out loud to someone who reads nothing. No acronyms, no document names, no dates, no jargon. If you cannot write it, return an empty string and this candidate dies here rather than downstream.",
    ),

  // Replaces why_you, which argued the story against the strategy after the
  // fact. These two are the things a good editor actually says out loud.
  unknowns: z
    .string()
    .describe("What you do not know yet. The hole in this story as it stands. Never 'nothing'."),
  kill_reason: z
    .string()
    .describe(
      "The strongest honest argument for killing this candidate. Argue it properly, as its opponent would. A weak kill_reason is itself a reason to distrust the story.",
    ),

  primary_emotion: z
    .enum(["knowledge", "amusement", "jolt", "admiration", "inspiration", "craving", "calm"])
    .describe(
      "One only. 'knowledge' is the home lane: knowing something and feeling you learned it. The others are seasoning and should be the minority of any slate.",
    ),
  output_format: z
    .enum(["script", "written", "artifact"])
    .describe(
      "What this material actually wants to be. Some strong material is a byline and a bad video; some is a thing to build rather than say. Be honest, a mis-route wastes the shoot.",
    ),

  angle: z.string().describe("A suggested opening angle written in the creator's voice."),
  suggested_pillar_id: z.string().nullish(),
})

const synthesisSchema = z.object({
  stories: z.array(storySchema).max(MAX_STORIES_PER_RUN),
})

type SignalRow = {
  id: string
  source_key: string
  title: string
  url: string | null
  published_at: string | null
  snippet: string | null
  topics: string[]
  lane: string
  stance: string
}

/**
 * Constructions that talk down to the viewer, or that only stand up by
 * comparison to what an institution failed to do.
 *
 * Enforced in code because a prompt rule against a phrasing habit decays: the
 * model complies for a run or two and then finds a synonym. These are the exact
 * forms named in the spec plus their nearest neighbours, and a candidate hitting
 * one is killed rather than rewritten, because the phrasing is a symptom. A
 * thesis that reaches for "nobody in the profession has" is usually a thesis
 * whose only claim to novelty is somebody else's absence.
 */
const BANNED_STANCE = [
  /nobody in the (?:profession|industry|field)/i,
  /no one in the (?:profession|industry|field)/i,
  /the institutes? (?:should|need to|must|have failed)/i,
  /the (?:profession|industry) is (?:behind|lagging|asleep|not ready)/i,
  /this is what we should be doing/i,
  /the (?:profession|industry) has(?:n't| not) (?:yet )?(?:caught|woken|realised|realized)/i,
]

/**
 * Acronyms a working professional reads without decoding. Everything else in a
 * hook is a term the viewer has to be taught, and teaching in the hook is what
 * makes the first sentence unsayable.
 */
const HOOK_SAFE_ACRONYMS = new Set(["AI", "US", "UK", "EU", "IT", "CEO", "CFO", "CV", "OK", "TV"])

const DATE_IN_HOOK = /\b(?:19|20)\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i

/**
 * The candidate gate. Fail any one, kill the candidate.
 *
 * Deliberately not "downgrade to watchlist". Watchlist means the thesis is
 * sound but under-evidenced and may pass tomorrow when a second signal lands. A
 * gate failure is structural: no actor, no stakes, two unknowns, no open
 * question. Tomorrow's signals do not fix any of those, so leaving it in a queue
 * to be reconsidered is just a slower kill with a worse feed.
 */
export function gateFailure(story: {
  named_actor: string
  stakes: string
  unknown_terms: string
  open_question: string
  hook_line: string
  thesis: string
  angle: string
}): string | null {
  const actor = story.named_actor.trim()
  if (actor.length < 3) {
    return "No named actor: nothing happened, something was merely published."
  }
  // named_actor should be names, semicolon separated, and nothing else. A verb
  // in it means the model wrote a sentence, and the sentence is almost always
  // "X published Y", which is precisely the thing the gate exists to reject: a
  // body expressing a view is not somebody doing something. Checked on the verb
  // rather than on the noun because "the FRC" is a perfectly good actor on the
  // day it fines someone.
  const publishingVerb = actor.match(
    /\b(?:published|issued|released|stated|said|announced|noted|warned|reported|wrote|commented|proposed)\b/i,
  )
  if (publishingVerb) {
    return `Not an action: "${publishingVerb[0]}" is something a document does, not something an actor did. Name the party, or find the thing that made the publication necessary.`
  }
  if (actor.length > 120) {
    return "named_actor is a sentence rather than a name, which means no single party actually acted."
  }
  if (story.stakes.trim().length < 20) {
    return "No stakes the receipts support: nobody visibly loses, changes or is embarrassed."
  }

  const unknowns = story.unknown_terms
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
  if (unknowns.length > 1) {
    return `Two or more unknowns (${unknowns.join(", ")}): the payoff cannot arrive before both are taught. Split into separate candidates.`
  }

  if (story.open_question.trim().length < 10) {
    return "Nothing unresolved: this is a news unpack rather than primary work."
  }

  const stance = `${story.thesis} ${story.angle} ${story.hook_line}`
  const banned = BANNED_STANCE.find((re) => re.test(stance))
  if (banned) {
    return `Stance is written about the profession rather than to a practitioner (matched ${banned}).`
  }

  const hook = story.hook_line.trim()
  if (hook.length < 10) return "No hook line: it could not be said out loud to someone who reads nothing."
  const acronym = hook.match(/\b[A-Z]{2,}\b/g)?.find((a) => !HOOK_SAFE_ACRONYMS.has(a))
  if (acronym) return `Hook line needs decoding: "${acronym}" is an acronym the viewer has to be taught.`
  if (DATE_IN_HOOK.test(hook)) return "Hook line carries a date, which is trigger material rather than hook material."

  return null
}

const SYSTEM_PROMPT = `You are the research desk of a one-person creator's management agency. You are an investigative researcher, not an aggregator: your job is to connect dots across signals and produce theses the creator could not get from any single headline.

Each signal is tagged with a LANE and a STANCE.

LANE is the register a signal came from, and the lanes are not equal.

PRIMARY lanes hold the document itself:
- papers: preprints and research, the claim before the coverage
- patents: what was filed, which is R&D intent rather than marketing, published about 18 months after filing and still ahead of any launch
- filings: what a company told investors under legal liability, which is a very different document from its blog
- courts: complaints, dockets and opinions, often years before any landmark ruling, and expert reports are frequently the most detailed public technical documents that exist on how a system actually works
- funding: research grants and private raises, funded now, published in about two years, productised in about four
- regulation: proposed rules and open comment periods, visible long before anything binds, and a comment period is a door with a deadline
- standards: what "compliant" is going to mean, drafted before anyone has to comply and read by almost nobody
- code: what engineers are actually adopting, which happens before a vendor describes it
- models: what actually shipped, where capability is measurable rather than asserted
- releases: what labs published themselves, unmediated by coverage

FIRST SIGNAL lanes sit upstream of all of the above, because an institution can only publish about a thing after it exists and someone noticed:
- changelogs: what a model or platform can do that it could not do last week, written the day it shipped for people who will use it rather than write about it
- ventures: who put money behind a specific future. A seed round is not an opinion about whether something should exist, it is a decision that it will, with people hired to build it. A funded competitor inside the creator's own profession is a story no institution can tell, because it is not a position, it is a rival
- grants: funded research at the moment of award, roughly two years before the paper and four before anything ships
- solicitations: a government describing technology that does not exist yet and attaching money to it, two to four years out
- jobs: roles being hired. A firm creating a "Head of AI Assurance" has already decided, budgeted and got sign-off, months before it says anything publicly, and the job spec names the actual tools and frameworks
- scholarship: the accounting, audit, law and finance literature, which is published almost entirely outside the preprint servers
- inspections: what a regulator found when it actually looked, naming deficiencies rather than stating positions
- consultations: open consultations and exposure drafts. These have deadlines, and responses are published under the respondent's name, which makes them the cheapest route from commentator to named participant
- supervisors: central banks and financial stability bodies, who publish early and carefully
- procurement: tenders and contract notices, where the specification and often the price are attached. A tender is a commitment; a press release is not
- conferences: accepted papers and calls, roughly a year ahead of the trade press
- retractions: the retraction notice itself
- syscards: a lab's technical appendix, where the evaluations and known failure modes live, which is a different genre from the launch post everyone reads instead

SECONDARY lanes are someone writing about what already happened: news, books, discussion.

This distinction is the point of the desk. The creator is trying to be a primary producer of information rather than a second-hand reporter, so:
- A thesis built on primary documents outranks a better-written thesis built on news. Reach for the filing, the docket, the patent, the standard.
- Where a primary source and the coverage of it disagree, that gap is itself the story, and it is the single most valuable thing you can find.
- When you cite a primary document, the receipt should quote the document, not the summary of it. That is what lets the creator say "I read the filing" and be telling the truth.
- News is best used to date something or to show what the consensus reading is, so that the primary document can be set against it.
- Two news items about the same event is the weakest possible connection. Avoid it.

EARLINESS IS A SCORE IN ITS OWN RIGHT. The creator's stated position is to be the person who knows first, to the point that the institutions in their field read them to find out what is happening. That is only possible on material the institutions have not processed yet. So:
- A thing that exists, is documented, and almost nobody has noticed outranks a better-argued thesis about something already covered. Prefer the funded company, the shipped capability, the awarded grant, the open solicitation.
- Say plainly in "why_now" how far ahead of the coverage the creator would be. "This raised in April and no accounting title has written about it" is a stronger reason to shoot than "this is topical".
- Do not reach for the institutions as the frame. A professional body publishing a position is downstream of the thing that made the position necessary; find the thing. Where an institution appears at all, the interesting shape is the distance between what has been built and what the institution has noticed.
- Capability signals are relevant even when the release note never mentions the creator's profession. A model that can now read a hundred page document reliably is an audit story whether or not the changelog says so, and joining those two is exactly the work.
- The strongest theses join lanes that rarely meet: a preprint that contradicts a press release, a patent that shows a vendor knew, a comment period nobody in the profession has noticed, a repo that proves the capability exists already.

STANCE is where the topic sits relative to this creator: core is ground they already own; adjacent is the stretch beside it; horizon is territory they told you they are moving toward and may have published nothing in yet.
- Set "move" to consolidate for a thesis that deepens core ground, expand for adjacent territory, advance for one that builds the position in their stated trajectory.
- Do not refuse a horizon story merely because there is no precedent in the canon: the absence of precedent is the reason the creator declared it. Standing can come from adjacent expertise, not only from having covered the exact topic before.

THE CANDIDATE GATE. Every candidate must survive all six of these. They are checked in code after you answer, and a candidate that fails one is killed outright rather than passed on to be fixed. Do not soften a field to get a candidate through: an honest empty string kills it here, which is cheap, while a plausible one kills it after a shoot, which is not.

1. NAMED ACTOR. Someone did something. A document is not an actor. "The FRC published" is weak. "PwC filed", "the court compelled", "this firm was sanctioned" is strong. If the only thing that happened is that a body expressed a view, there is no actor.
2. STAKES. Who loses, who is embarrassed, who has to change what they do, and by when. This is the boredom gate and the most important field you will fill. If it cannot be filled from the receipts, there is no emotion available downstream and the piece will be inert no matter how well it is written.
3. ONE UNKNOWN. At most one document, body or concept the audience has never heard of. Two unknowns means teaching both before the payoff arrives, which makes releasing information gradually impossible. If a thesis needs two, split it into two candidates rather than joining them.
4. OPEN QUESTION. Something this card genuinely cannot answer. If everything is resolved, this is a news unpack, not primary work.
5. STANCE. Write to a practitioner about their own work. Never to or about the profession's governing bodies. Kill any thesis that only stands up by comparison to what an institute failed to do. These constructions are banned outright: "nobody in the profession has", "the institutes should", "the industry is behind", "this is what we should be doing". Talking down to the viewer reads as distrust, and distrust loses the room faster than boredom does.
6. HOOK LINE. One sentence, sayable out loud to someone who reads nothing. No acronyms, no document names, no dates. If you cannot write it, return an empty string and kill the candidate yourself rather than passing the problem up.

WHAT REPLACES SELF-JUSTIFICATION. You are no longer asked why a story is worth the creator's time. That field became a compliance check written after the decision. Instead:
- "unknowns": what you do not know yet. The hole in the story as it stands. "Nothing" is never the answer.
- "kill_reason": the strongest honest argument against running it, argued as its opponent would argue it. A weak kill_reason is itself evidence the story has not been tested.

EMOTION. Pick exactly one primary_emotion. "knowledge" is the home lane, because knowing something and feeling you learned it is what earns a completion and a send-to-a-friend. The rest are seasoning: a slate that is mostly jolt is a tabloid, and a slate that is mostly inspiration is a LinkedIn feed.

OUTPUT FORMAT. Some strong material is a byline and a bad video, and some is a thing to build rather than a thing to say. Tag it honestly as script, written or artifact. A mis-route wastes a shoot and then reads to the creator as their own failure, which is the expensive part.

The failure mode you are being corrected for: this desk keeps handing back deeper cuts of ground the creator has already worked to death. A creator with a strong archive on one subject will get proposed that subject forever, because it is what the evidence supports, and they will stay a commentator on it instead of becoming the authority they said they want to be. A thesis that only restates their existing position is low value to them even when it is well built.

Rules:
- A thesis must REQUIRE at least two of the provided signals together (or one signal connected to the creator's own published work for kind "own_content"). If a candidate idea rests on a single headline, do not propose it.
- Prefer contradiction (received wisdom vs the data), cross-lane connection, and second-order implications for the creator's specific audience.
- Never repeat or lightly rephrase a thesis from the "recent theses" list.
- Receipts must be concrete: a number, a quote, a named finding — not "sources say".
- Write "angle" in the creator's voice profile if one is provided; otherwise plain and direct.
- When a trajectory is declared, at least half the slate must be advance or expand, and the advance stories should be the ones you argue hardest for. A slate of eight consolidate stories is a failed run even if every thesis is sound.
- Balance still matters in the other direction: a slate with nothing the creator can speak to from experience leaves them sounding unmoored. Keep one or two consolidate stories that put their existing authority behind the newer ground.
- Fewer, stronger stories beat more, weaker ones. Zero stories is an acceptable output. A slate of two candidates that pass the gate is a better run than eight that were nursed through it.

SCORING. Where a flagship question is given below, rank candidates by how directly they advance THAT ARGUMENT, and by nothing else. The named argument outranks the named formats. The strategy listed formats as a means of making the argument, and this desk has been fetching instances of the formats instead, which is how a plan becomes a checklist. If a candidate is a perfect example of a favoured format and does not move the flagship question, it ranks below a rougher candidate that does.`

export type SynthesisResult = {
  proposed: number
  watchlisted: number
  /** Killed by the candidate gate: structurally unshootable, not merely thin. */
  gated: number
  skipped_bad_refs: number
  tokens: number
}

export async function synthesiseStoriesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SynthesisResult> {
  const since = new Date(Date.now() - SIGNAL_WINDOW_HOURS * 3600 * 1000).toISOString()

  // One query per lane so each register is guaranteed a place in the prompt.
  const laneQueries = Object.entries(LANE_QUOTAS).map(async ([lane, quota]) => {
    const { data } = await supabase
      .schema("creator")
      .from("creator_signals")
      .select("id,source_key,title,url,published_at,snippet,topics,lane,stance")
      .eq("user_id", userId)
      .eq("lane", lane)
      .gte("ingested_at", since)
      .order("published_at", { ascending: false })
      .limit(quota)
    return (data ?? []) as SignalRow[]
  })

  // Horizon signals get their own guaranteed slice, not just a place in the
  // lane queues. Territory the creator has no corpus in is thin by definition,
  // so a per-lane "newest N" would let this week's noisy core news crowd it out
  // entirely and the sweep's whole point would be lost between retrieval and
  // the prompt.
  const horizonQuery = supabase
    .schema("creator")
    .from("creator_signals")
    .select("id,source_key,title,url,published_at,snippet,topics,lane,stance")
    .eq("user_id", userId)
    .eq("stance", "horizon")
    .gte("ingested_at", since)
    .order("published_at", { ascending: false })
    .limit(HORIZON_QUOTA)

  const [
    laneResults,
    { data: horizonRows },
    trajectory,
    { data: canon },
    { data: recentPosts },
    { data: recentStories },
  ] = await Promise.all([
    Promise.all(laneQueries),
    horizonQuery,
    loadTrajectory(supabase, userId),
    supabase.schema("creator").from("creator_canon")
      .select("version,pillars,voice,topics")
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.schema("creator").from("creator_content")
      .select("caption,transcript,posted_at,metrics")
      .eq("user_id", userId)
      .order("posted_at", { ascending: false })
      .limit(15),
    supabase.schema("creator").from("creator_stories")
      .select("thesis")
      .eq("user_id", userId)
      // An archived thesis is still on the do-not-repeat list, which is the
      // point of archiving. A deleted one is not.
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
      .limit(30),
  ])

  // Interleave lanes so no single register dominates the head of the list —
  // ordering shapes what the model reaches for first.
  const byLane = laneResults.filter((rows) => rows.length > 0)
  const interleaved: SignalRow[] = []
  for (let i = 0; byLane.some((rows) => i < rows.length); i++) {
    for (const rows of byLane) {
      if (i < rows.length) interleaved.push(rows[i])
    }
  }

  // Horizon signals lead, for the same reason they get their own quota: they are
  // the ones the creator cannot already predict, and position in the list is
  // itself a weighting.
  const horizon = (horizonRows ?? []) as SignalRow[]
  const seen = new Set(horizon.map((s) => s.id))
  const signalRows: SignalRow[] = [...horizon, ...interleaved.filter((s) => !seen.has(s.id))]

  if (signalRows.length < 2) {
    return { proposed: 0, watchlisted: 0, gated: 0, skipped_bad_refs: 0, tokens: 0 }
  }

  const signalList = signalRows
    .map(
      (s, i) =>
        `[${i}] lane=${s.lane} stance=${s.stance} topic=${s.topics?.[0] ?? "—"} (${s.published_at ?? "undated"}) ${s.title}${
          s.snippet ? ` — ${s.snippet.slice(0, 280)}` : ""
        }`,
    )
    .join("\n")

  const canonBlock = canon
    ? `CREATOR CANON (v${canon.version}):\nPillars: ${JSON.stringify(canon.pillars)}\nTopics: ${JSON.stringify(canon.topics)}\nVoice: ${JSON.stringify(canon.voice)}`
    : "CREATOR CANON: not yet derived — use the signals' topics as the creator's declared niche."

  const corpusBlock = (recentPosts ?? []).length
    ? `RECENT PUBLISHED WORK (for own_content connections):\n${(recentPosts ?? [])
        .map((p) => `- ${(p.transcript ?? p.caption ?? "").slice(0, 200)}`)
        .filter((line) => line.length > 2)
        .join("\n")}`
    : "RECENT PUBLISHED WORK: none ingested yet."

  const recentTheses = (recentStories ?? []).map((s) => `- ${s.thesis}`).join("\n") || "- none"

  const { object, usage } = await creatorGenerateObject({
    schema: synthesisSchema,
    system: SYSTEM_PROMPT,
    prompt: `SIGNALS (last ${SIGNAL_WINDOW_HOURS}h, numbered):\n${signalList}\n\n${trajectoryBlock(trajectory)}\n\n${canonBlock}\n\n${corpusBlock}\n\nRECENT THESES (do not repeat):\n${recentTheses}\n\nProduce at most ${MAX_STORIES_PER_RUN} story dossiers.`,
    agent: "research.synthesise",
    log: { supabase, userId },
    maxOutputTokens: 8000,
  })

  const result: SynthesisResult = {
    proposed: 0,
    watchlisted: 0,
    gated: 0,
    skipped_bad_refs: 0,
    tokens: usage.totalTokens,
  }

  // Everything that reached the prompt was read and judged, whether or not it
  // was used. Recording that is what lets the feed show "considered but not
  // filed", which is the most interesting slice in it: documents a machine
  // looked at and passed on, where the creator might not have.
  const consideredAt = new Date().toISOString()
  await supabase
    .schema("creator")
    .from("creator_signals")
    .update({ considered_at: consideredAt })
    .eq("user_id", userId)
    .in("id", signalRows.map((s) => s.id))

  for (const story of object.stories) {
    const referenced = [...new Set([...story.signal_indexes, ...story.receipts.map((r) => r.signal_index)])]
      .filter((i) => i >= 0 && i < signalRows.length)
    if (!referenced.length) {
      result.skipped_bad_refs++
      continue
    }

    const signalIds = referenced.map((i) => signalRows[i].id)
    const receipts = story.receipts
      .filter((r) => r.signal_index >= 0 && r.signal_index < signalRows.length)
      .map((r) => ({
        signal_id: signalRows[r.signal_index].id,
        url: signalRows[r.signal_index].url,
        title: signalRows[r.signal_index].title,
        quote: r.quote,
      }))

    // Two separate gates, and the order matters. The candidate gate is
    // structural and terminal: no actor, no stakes, two unknowns. The evidence
    // gate is about weight of sourcing and is survivable, because a second
    // signal can land tomorrow. Running the terminal one first stops a
    // structurally dead candidate from sitting in the watchlist looking like it
    // is waiting for something.
    const failure = gateFailure(story)

    // The editor gate. own_content stories may stand on one signal + the corpus;
    // everything else needs at least two independent signals or it stays on watch.
    const distinctSignals = new Set(signalIds).size
    const hasEvidence = story.synthesis_kind === "own_content" ? distinctSignals >= 1 : distinctSignals >= 2

    const state = failure ? "killed" : hasEvidence ? "proposed" : "watchlist"

    const { data: storyRow, error: storyError } = await supabase
      .schema("creator")
      .from("creator_stories")
      .insert({
        user_id: userId,
        state,
        thesis: story.thesis,
        synthesis_kind: story.synthesis_kind,
        move: story.move,
        receipts,
        signal_ids: signalIds,
        why_now: story.why_now,
        named_actor: story.named_actor,
        stakes: story.stakes,
        open_question: story.open_question,
        hook_line: story.hook_line,
        unknowns: story.unknowns,
        kill_reason: story.kill_reason,
        primary_emotion: story.primary_emotion,
        output_format: story.output_format,
        gate_failure: failure,
        angle: story.angle,
        canon_version: canon?.version ?? null,
        suggested_pillar_id: story.suggested_pillar_id,
        model_version: CREATOR_MODEL_VERSION,
        prompt_version: SYNTHESIS_PROMPT_VERSION,
      })
      .select("id")
      .single()
    if (storyError) throw storyError

    if (state === "killed") {
      result.gated++
      continue
    }
    if (state === "watchlist") {
      result.watchlisted++
      continue
    }

    // Promote to the Desk: an insight awaiting the creator's decision.
    const { data: workRow, error: workError } = await supabase
      .schema("creator")
      .from("creator_work")
      .insert({
        user_id: userId,
        kind: "insight",
        state: "proposed",
        autonomy: "approve",
        // The hook leads. It is the one line the creator can judge in a second,
        // and the thesis is what they read once the hook has earned the second
        // second. Stakes carry the rationale, because "who loses and by when" is
        // the actual reason to shoot a thing.
        title: story.hook_line,
        body: `${story.thesis}\n\nWhy now: ${story.why_now}\n\nOpen question: ${story.open_question}`,
        rationale: story.stakes,
        provenance: {
          agent: "researcher",
          canon_version: canon?.version ?? 0,
          source_post_ids: [],
          story_id: storyRow.id,
          signal_ids: signalIds,
        },
        pillar_id: story.suggested_pillar_id,
      })
      .select("id")
      .single()
    if (workError) throw workError

    await supabase
      .schema("creator")
      .from("creator_stories")
      .update({ work_item_id: workRow.id })
      .eq("id", storyRow.id)

    await supabase
      .schema("creator")
      .from("creator_signals")
      .update({ used_at: consideredAt })
      .eq("user_id", userId)
      .in("id", signalIds)

    result.proposed++
  }

  return result
}
