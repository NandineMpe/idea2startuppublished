/**
 * Re-run profile extraction writes for a user using markdown heuristic (no Inngest).
 * Usage: npx tsx scripts/careeros-repair-profile-extract.ts <user_id>
 */
import { createHash, randomUUID } from "crypto"
import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import {
  extractProfileFromLlmMarkdown,
  hasMarkdownProfileSignal,
} from "../lib/careeros/extraction/markdown-profile-fallback"
import { PROFILE_EXTRACT_PROMPT_VERSION } from "../lib/careeros/prompts/profile-extract.v1"
import { PROFILE_EXTRACTION_SCHEMA_VERSION } from "../lib/careeros/schemas/profile-extraction.v1"

function loadEnv() {
  for (const f of [".env.vercel.production", ".env.vercel.preview", ".env"]) {
    const p = path.join(process.cwd(), f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  }
}

async function main() {
  loadEnv()
  const userId = process.argv[2] || "961be40a-f699-468b-82ff-45d15e5eb2b4"
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profile } = await sb
    .schema("careeros")
    .from("user_profiles")
    .select("current_role_title,years_experience")
    .eq("user_id", userId)
    .maybeSingle()

  const { data: doc } = await sb
    .schema("careeros")
    .from("user_documents")
    .select("id,storage_path")
    .eq("user_id", userId)
    .eq("doc_type", "llm_markdown")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!doc?.storage_path) {
    console.error("No llm_markdown document for user", userId)
    process.exit(1)
  }

  const { data: blob, error: dlErr } = await sb.storage
    .from("careeros-documents")
    .download(doc.storage_path as string)
  if (dlErr) throw dlErr

  const md = Buffer.from(await blob.arrayBuffer()).toString("utf8")
  const extraction = extractProfileFromLlmMarkdown(md, {
    userStatedRole: profile?.current_role_title ?? null,
    userStatedYearsExperience: profile?.years_experience ?? null,
  })

  if (!hasMarkdownProfileSignal(extraction)) {
    console.error("Markdown parser returned no signal")
    process.exit(1)
  }

  const docId = doc.id as string
  await sb
    .schema("careeros")
    .from("user_document_extractions")
    .update({ is_current: false })
    .eq("user_document_id", docId)
    .eq("parser_name", "careeros-profile-extract")
    .eq("is_current", true)

  const { data: latest } = await sb
    .schema("careeros")
    .from("user_document_extractions")
    .select("extraction_version")
    .eq("user_document_id", docId)
    .eq("parser_name", "careeros-profile-extract")
    .order("extraction_version", { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = ((latest?.extraction_version as number | undefined) ?? 0) + 1
  const inputHash = createHash("sha256").update(md).digest("hex")

  const { data: inserted, error: insErr } = await sb
    .schema("careeros")
    .from("user_document_extractions")
    .insert({
      user_id: userId,
      user_document_id: docId,
      parser_name: "careeros-profile-extract",
      parser_version: PROFILE_EXTRACT_PROMPT_VERSION,
      extraction_version: nextVersion,
      is_current: true,
      parsed_payload: extraction,
      input_data_version: inputHash,
      extraction_method: "markdown_heuristic",
      source_attribution: { llm_markdown_used: true, repair: true },
    })
    .select("id")
    .single()
  if (insErr) throw insErr

  await sb.schema("careeros").from("user_skills").update({ is_active: false }).eq("user_id", userId).eq("is_active", true)

  const seen = new Set<string>()
  const skillRows = extraction.skills
    .filter((s) => {
      if (seen.has(s.canonical_skill_key)) return false
      seen.add(s.canonical_skill_key)
      return true
    })
    .map((s) => ({
      user_id: userId,
      canonical_skill_key: s.canonical_skill_key,
      skill_name: s.skill_name,
      proficiency_band: s.proficiency_band,
      evidence_payload: { evidence: s.evidence, source: s.source_type },
      source_type: s.source_type,
      is_active: true,
      is_placeholder: false,
      provenance_workflow: "careeros/profile.extract",
      last_seen_at: new Date().toISOString(),
    }))

  if (skillRows.length > 0) {
    const { error: skErr } = await sb.schema("careeros").from("user_skills").insert(skillRows)
    if (skErr) throw skErr
  }

  const now = new Date().toISOString()
  await sb.schema("careeros").from("user_profiles").upsert(
    {
      user_id: userId,
      current_role_title: profile?.current_role_title ?? extraction.current_role,
      years_experience: profile?.years_experience ?? extraction.years_experience,
      last_profile_extraction_id: inserted.id,
      profile_ready_at: skillRows.length > 0 ? now : null,
      updated_at: now,
    },
    { onConflict: "user_id" },
  )

  const { data: settings } = await sb
    .schema("careeros")
    .from("user_settings")
    .select("onboarding_state")
    .eq("user_id", userId)
    .maybeSingle()

  const prev = (settings?.onboarding_state as Record<string, unknown> | null) ?? {}
  const m11 =
    typeof prev.module_1_1 === "object" && prev.module_1_1 !== null
      ? (prev.module_1_1 as Record<string, unknown>)
      : {}
  const m12 =
    typeof m11.module_1_2 === "object" && m11.module_1_2 !== null
      ? (m11.module_1_2 as Record<string, unknown>)
      : {}

  await sb.schema("careeros").from("user_settings").upsert(
    {
      user_id: userId,
      notification_preferences: {},
      privacy_preferences: {},
      onboarding_state: {
        ...prev,
        module_1_1: {
          ...m11,
          module_1_2: {
            ...m12,
            status: "completed",
            completedAt: now,
            skillsCount: extraction.skills.length,
            topSkills: extraction.skills.slice(0, 8).map((s) => s.skill_name),
            suggestedRoles: extraction.past_roles.slice(0, 3).map((r) => r.title),
            extractionId: inserted.id,
          },
        },
      },
      updated_at: now,
    },
    { onConflict: "user_id" },
  )

  console.log("Repaired profile for", userId)
  console.log("extraction id:", inserted.id)
  console.log("skills:", extraction.skills.length, "roles:", extraction.past_roles.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
