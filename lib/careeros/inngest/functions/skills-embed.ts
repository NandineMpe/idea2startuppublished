import { randomUUID } from "crypto"
import {
  SKILL_EMBEDDING_DIM,
  SKILL_EMBEDDING_MODEL,
  SKILL_EMBEDDING_VERSION,
  buildSkillEmbeddingInput,
  embedSkillInputText,
  formatVectorLiteral,
  getOpenAiEmbeddingApiKey,
} from "@/lib/careeros/ai/skill-embedding"
import { mergeCareerOsModule14State } from "@/lib/careeros/onboarding/user-settings"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

export const skillsEmbed = careerosInngest.createFunction(
  {
    id: "careeros-skills-embed",
    retries: 2,
    triggers: [{ event: "careeros/skills.embed" }],
    concurrency: {
      key: "event.data.user_id",
      limit: 1,
    },
  },
  async ({ event, step }) => {
    const { user_id: userId } = event.data

    if (!getOpenAiEmbeddingApiKey()) {
      await step.run("skip-no-openai", async () => {
        await mergeCareerOsModule14State(userId, {
          embeddings: {
            status: "skipped",
            completedAt: new Date().toISOString(),
            reason: "missing_openai_api_key",
          },
        })
      })
      return { user_id: userId, skipped: true as const, reason: "missing_openai_api_key" }
    }

    const rows = await step.run("load-active-skills", async () => {
      const { data, error } = await supabaseAdmin
        .schema("careeros")
        .from("user_skills")
        .select("id,skill_name,source_type,evidence_payload,onet_skill_id")
        .eq("user_id", userId)
        .eq("is_active", true)
      if (error) throw error
      return data ?? []
    })

    const existing = await step.run("load-existing-embedding-keys", async () => {
      if (rows.length === 0) return new Set<string>()
      const ids = rows.map((r) => r.id as string)
      const { data, error } = await supabaseAdmin
        .schema("careeros")
        .from("user_skill_embeddings")
        .select("user_skill_id")
        .eq("user_id", userId)
        .eq("embedding_version", SKILL_EMBEDDING_VERSION)
        .in("user_skill_id", ids)
      if (error) throw error
      return new Set((data ?? []).map((x) => x.user_skill_id as string))
    })

    let embedded = 0
    let skippedAlready = 0

    for (const row of rows) {
      const skillId = row.id as string
      if (existing.has(skillId)) {
        skippedAlready += 1
        continue
      }

      const added = await step.run(`embed-skill-${skillId}`, async (): Promise<0 | 1> => {
        const input = buildSkillEmbeddingInput({
          skill_name: row.skill_name as string,
          source_type: row.source_type as string | null,
          evidence_payload: row.evidence_payload,
          onet_skill_id: row.onet_skill_id as string | null,
        })
        const vec = await embedSkillInputText(input)
        const { error } = await supabaseAdmin
          .schema("careeros")
          .from("user_skill_embeddings")
          .upsert(
            {
              user_id: userId,
              user_skill_id: skillId,
              embedding_model: SKILL_EMBEDDING_MODEL,
              embedding_dim: SKILL_EMBEDDING_DIM,
              embedding_version: SKILL_EMBEDDING_VERSION,
              embedding: formatVectorLiteral(vec),
            },
            { onConflict: "user_skill_id,embedding_version" },
          )
        if (error) throw error
        return 1
      })
      embedded += added
    }

    await step.run("audit-generation-run", async () => {
      const { error } = await supabaseAdmin.schema("careeros").from("generation_runs").insert({
        id: randomUUID(),
        user_id: userId,
        artefact_table: "careeros.user_skill_embeddings",
        artefact_id: null,
        workflow_name: "careeros/skills.embed",
        provider: "other",
        model_name: SKILL_EMBEDDING_MODEL,
        model_version: SKILL_EMBEDDING_VERSION,
        prompt_version: "skill-name+evidence+onet",
        schema_version: "1",
        input_data_version: SKILL_EMBEDDING_VERSION,
        source_attribution: {
          skills_considered: rows.length,
          embedded,
          skipped_already: skippedAlready,
        },
        input_hash: SKILL_EMBEDDING_VERSION,
        output_hash: `${embedded}:${rows.length}`,
        latency_ms: null,
        token_usage: null,
        status: "completed",
      })
      if (error) throw error
    })

    await step.run("mark-module-14-embeddings", async () => {
      await mergeCareerOsModule14State(userId, {
        embeddings: {
          status: "completed",
          completedAt: new Date().toISOString(),
          model: SKILL_EMBEDDING_MODEL,
          version: SKILL_EMBEDDING_VERSION,
          dimension: SKILL_EMBEDDING_DIM,
          embeddedCount: embedded,
          skippedAlreadyCount: skippedAlready,
          skillsConsidered: rows.length,
        },
      })
    })

    return {
      user_id: userId,
      skills_considered: rows.length,
      embedded,
      skipped_already: skippedAlready,
    }
  },
)
