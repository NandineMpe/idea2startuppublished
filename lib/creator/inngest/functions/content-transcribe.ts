import { creatorInngest } from "../client"
import { supabaseAdmin } from "@/lib/supabase"

/**
 * Transcription via ElevenLabs Scribe. On a video-first platform the spoken
 * audio IS the corpus, so this step gates voice derivation.
 *
 * Honest limitation: a TikTok share link is a web page, not media, so export
 * rows carry no fetchable audio and are marked `unavailable` rather than
 * pretending. Rows gain a transcript when (a) the import supplied one, or
 * (b) raw_payload carries a direct media URL (future Display API adapter, or
 * a manual media_url).
 */

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"

function mediaUrlFrom(rawPayload: Record<string, unknown> | null): string | null {
  if (!rawPayload) return null
  const candidate = rawPayload["media_url"] ?? rawPayload["MediaUrl"] ?? rawPayload["download_url"]
  if (typeof candidate !== "string" || !candidate.trim()) return null
  // Must be a direct media resource, not a share page.
  if (/tiktok\.com\/@/.test(candidate)) return null
  return candidate.trim()
}

export const creatorContentTranscribe = creatorInngest.createFunction(
  {
    id: "creator-content-transcribe",
    name: "Creator OS: transcribe content",
    retries: 2,
    // ElevenLabs concurrency is account-limited; keep the fan-out polite.
    concurrency: { limit: 3 },
    triggers: [{ event: "creator/content.transcribe" }],
  },
  async ({ event, step }) => {
    const { user_id: userId, content_id: contentId } = event.data

    const row = await step.run("load-row", async () => {
      const { data, error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .select("id,transcript,transcript_status,raw_payload")
        .eq("id", contentId)
        .eq("user_id", userId)
        .maybeSingle()
      if (error) throw error
      return data
    })

    if (!row || row.transcript || row.transcript_status === "done") {
      return { content_id: contentId, outcome: "skipped" }
    }

    const mediaUrl = mediaUrlFrom(row.raw_payload as Record<string, unknown> | null)
    if (!mediaUrl) {
      await step.run("mark-unavailable", async () => {
        const { error } = await supabaseAdmin
          .schema("creator")
          .from("creator_content")
          .update({ transcript_status: "unavailable" })
          .eq("id", contentId)
        if (error) throw error
      })
      return { content_id: contentId, outcome: "unavailable" }
    }

    await step.run("mark-running", async () => {
      const { error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .update({ transcript_status: "running" })
        .eq("id", contentId)
      if (error) throw error
    })

    const transcript = await step.run("scribe", async () => {
      const key = process.env.ELEVENLABS_API_KEY?.trim()
      if (!key) throw new Error("Missing ELEVENLABS_API_KEY")

      const form = new FormData()
      form.append("model_id", "scribe_v1")
      form.append("cloud_storage_url", mediaUrl)

      const res = await fetch(ELEVENLABS_STT_URL, {
        method: "POST",
        headers: { "xi-api-key": key },
        body: form,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`ElevenLabs STT HTTP ${res.status}: ${text.slice(0, 300)}`)
      }
      const data = (await res.json()) as { text?: string }
      return data.text?.trim() || null
    }).catch(async (e) => {
      await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .update({ transcript_status: "failed" })
        .eq("id", contentId)
      throw e
    })

    await step.run("store-transcript", async () => {
      const { error } = await supabaseAdmin
        .schema("creator")
        .from("creator_content")
        .update(
          transcript
            ? { transcript, transcript_status: "done" }
            : { transcript_status: "failed" },
        )
        .eq("id", contentId)
      if (error) throw error
    })

    return { content_id: contentId, outcome: transcript ? "done" : "failed" }
  },
)
