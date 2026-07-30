import { createHash, randomUUID } from "crypto"
import { getAnthropicApiKey } from "@/lib/careeros/ai/claude"
import { careerosMinIntervalMs } from "@/lib/careeros/integrations/rate-limits"
import {
  fetchOnetCareerSkillsFlat,
  getOnetAuthHeaders,
} from "@/lib/careeros/integrations/onet-request"
import {
  matchOccupationWithVectorAndClaude,
  type OccupationMatchContext,
} from "@/lib/careeros/onet/occupation-match"
import {
  matchSkillsWithVectorAndClaude,
  type UserSkillRow,
} from "@/lib/careeros/onet/skill-match"
import {
  mergeCareerOsModule14State,
  mergeCareerOsOnboardingState,
} from "@/lib/careeros/onboarding/user-settings"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest, sendCareerOSEvent } from "../client"

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export const profileOnetMap = careerosInngest.createFunction(
  {
    id: "careeros-profile-onet-map",
    retries: 2,
    triggers: [{ event: "careeros/profile.onet-map" }],
  },
  async ({ event, step }) => {
    const { user_id: userId } = event.data

    await step.run("mark-running", async () => {
      await mergeCareerOsOnboardingState(userId, {
        module_1_3: {
          status: "running",
          startedAt: new Date().toISOString(),
          method: "vector_claude_v1",
        },
      })
    })

    try {
      if (!getOnetAuthHeaders()) {
        await step.run("skip-no-onet-credentials", async () => {
          await mergeCareerOsOnboardingState(userId, {
            module_1_3: {
              status: "skipped",
              reason: "missing_onet_credentials",
              completedAt: new Date().toISOString(),
            },
          })
        })
        return { user_id: userId, skipped: true as const, reason: "missing_onet_credentials" }
      }

      if (!getAnthropicApiKey()) {
        await step.run("skip-no-claude", async () => {
          await mergeCareerOsOnboardingState(userId, {
            module_1_3: {
              status: "skipped",
              reason: "missing_anthropic_api_key",
              completedAt: new Date().toISOString(),
            },
          })
        })
        return { user_id: userId, skipped: true as const, reason: "missing_anthropic_api_key" }
      }

      const profile = await step.run("load-profile", async () => {
        const { data, error } = await supabaseAdmin
          .schema("careeros")
          .from("user_profiles")
          .select(
            "current_role_title,target_role_title,years_experience,location_label",
          )
          .eq("user_id", userId)
          .maybeSingle()
        if (error) throw error
        return data
      })

      const skillRows = await step.run("load-skills", async () => {
        const { data, error } = await supabaseAdmin
          .schema("careeros")
          .from("user_skills")
          .select("id,skill_name,canonical_skill_key,source_type,evidence_payload,onet_skill_id")
          .eq("user_id", userId)
          .eq("is_active", true)
        if (error) throw error
        return (data ?? []) as UserSkillRow[]
      })

      const topSkillNames = skillRows.map((s) => String(s.skill_name)).slice(0, 15)

      const occCtx: OccupationMatchContext = {
        current_role_title: (profile?.current_role_title as string | null) ?? null,
        target_role_title: (profile?.target_role_title as string | null) ?? null,
        years_experience:
          typeof profile?.years_experience === "number" ? profile.years_experience : null,
        top_skill_names: topSkillNames,
        location_label: (profile?.location_label as string | null) ?? null,
      }

      await step.sleep("onet-pace-before-search", careerosMinIntervalMs("onet"))

      const occupationMatch = await step.run("match-occupation-vector-claude", async () =>
        matchOccupationWithVectorAndClaude(occCtx),
      )

      if (!occupationMatch) {
        throw new Error("O*NET occupation mapping failed: no match from vector + Claude pipeline")
      }

      const socCode = occupationMatch.soc_code

      await step.sleep("onet-pace-before-skills", careerosMinIntervalMs("onet"))

      const careerSkills = await step.run("onet-career-skills", async () =>
        fetchOnetCareerSkillsFlat(socCode),
      )

      const occupationSkillCandidates = careerSkills.skills.map((s) => ({
        id: s.id,
        name: s.name,
      }))

      const profileSummary = [
        `SOC candidate: ${socCode} (${occupationMatch.title})`,
        occCtx.current_role_title ? `Current: ${occCtx.current_role_title}` : "",
        occCtx.target_role_title ? `Target: ${occCtx.target_role_title}` : "",
        typeof occCtx.years_experience === "number"
          ? `Experience: ${occCtx.years_experience} years`
          : "",
        topSkillNames.length ? `Skills: ${topSkillNames.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")

      const skillDecisions = await step.run("match-skills-vector-claude", async () =>
        matchSkillsWithVectorAndClaude({
          userSkills: skillRows,
          occupationSkills: occupationSkillCandidates,
          profileSummary,
          socCode,
        }),
      )

      let mapped = 0
      let needsReview = 0

      await step.run("apply-skill-mappings", async () => {
        for (const d of skillDecisions) {
          const review = d.needs_review || !d.onet_skill_id
          if (review) needsReview += 1
          else mapped += 1

          const { error } = await supabaseAdmin
            .schema("careeros")
            .from("user_skills")
            .update({
              onet_skill_id: d.onet_skill_id,
              onet_needs_review: review,
              onet_mapping_confidence: Number(d.claude_confidence.toFixed(4)),
              onet_mapping_payload: {
                method: d.method,
                vector_similarity: d.vector_similarity,
                matched_name: d.onet_skill_name,
                soc_code: socCode,
                needs_review: review,
              },
            })
            .eq("id", d.user_skill_id)
          if (error) throw error
        }
      })

      const skillGraphStored =
        careerSkills.ok && careerSkills.raw_graph !== undefined

      if (skillGraphStored) {
        await step.run("store-onet-skill-graph", async () => {
          const { error } = await supabaseAdmin
            .schema("careeros")
            .from("user_onet_skill_graphs")
            .upsert(
              {
                user_id: userId,
                onet_soc_code: socCode,
                graph_payload: JSON.parse(JSON.stringify(careerSkills.raw_graph)),
                endpoint_used: careerSkills.endpoint_used ?? null,
                fetch_http_status: careerSkills.status,
              },
              { onConflict: "user_id" },
            )
          if (error) throw error
        })
      }

      await step.run("update-profile-soc", async () => {
        const { error } = await supabaseAdmin
          .schema("careeros")
          .from("user_profiles")
          .upsert(
            {
              user_id: userId,
              onet_soc_code: socCode,
              onet_mapping_confidence: Number(occupationMatch.claude_confidence.toFixed(4)),
              onet_mapping_payload: {
                method: occupationMatch.method,
                keyword_role: occCtx.current_role_title,
                occupation_title: occupationMatch.title,
                vector_similarity: occupationMatch.vector_similarity,
                vector_rank: occupationMatch.vector_rank,
                candidates_considered: occupationMatch.candidates_considered,
                claude_rationale: occupationMatch.rationale,
                mapped_skill_rows: mapped,
                needs_review_skill_rows: needsReview,
                career_skills_fetch_ok: careerSkills.ok,
              },
            },
            { onConflict: "user_id" },
          )
        if (error) throw error
      })

      const inputPayload = {
        user_id: userId,
        soc_code: socCode,
        skill_row_ids: skillRows.map((s) => s.id).sort(),
        method: "vector_claude_v1",
      }
      const inputHash = sha256Hex(JSON.stringify(inputPayload))

      await step.run("audit-generation-run", async () => {
        const { error } = await supabaseAdmin.schema("careeros").from("generation_runs").insert({
          id: randomUUID(),
          user_id: userId,
          artefact_table: "careeros.user_profiles",
          artefact_id: null,
          workflow_name: "careeros/profile.onet-map",
          provider: "anthropic",
          model_name: "claude-sonnet-4-6",
          model_version: "vector_claude_v1",
          prompt_version: "onet-vector-top5-claude-confirm",
          schema_version: "2",
          input_data_version: inputHash,
          source_attribution: { soc_code: socCode, method: "vector_claude_v1" },
          input_hash: inputHash,
          output_hash: sha256Hex(
            JSON.stringify({ mapped, needsReview, socCode, careerSkillsOk: careerSkills.ok }),
          ),
          latency_ms: null,
          token_usage: null,
          status: "completed",
        })
        if (error) throw error
      })

      await step.run("mark-complete", async () => {
        await mergeCareerOsOnboardingState(userId, {
          module_1_3: {
            status: "completed",
            completedAt: new Date().toISOString(),
            onetSocCode: socCode,
            mappedSkillsCount: mapped,
            needsReviewSkillsCount: needsReview,
            careerSkillsFetchOk: careerSkills.ok,
            method: "vector_claude_v1",
          },
        })
        await mergeCareerOsModule14State(
          userId,
          careerSkills.ok
            ? skillGraphStored
              ? {
                  skill_graph: {
                    status: "completed",
                    completedAt: new Date().toISOString(),
                    onetSocCode: socCode,
                    endpointUsed: careerSkills.endpoint_used ?? null,
                    storedGraph: true,
                  },
                }
              : {
                  skill_graph: {
                    status: "skipped",
                    completedAt: new Date().toISOString(),
                    reason: "empty_skill_graph_payload",
                    onetSocCode: socCode,
                    storedGraph: false,
                  },
                }
            : {
                skill_graph: {
                  status: "skipped",
                  completedAt: new Date().toISOString(),
                  reason: "career_skills_fetch_not_ok",
                  httpStatus: careerSkills.status,
                  storedGraph: false,
                },
              },
        )
      })

      await step.run("enqueue-skills-embed", async () => {
        await sendCareerOSEvent({
          name: "careeros/skills.embed",
          data: { user_id: userId },
        })
      })

      return {
        user_id: userId,
        soc_code: socCode,
        mapped_skills: mapped,
        needs_review_skills: needsReview,
        career_skills_ok: careerSkills.ok,
        method: "vector_claude_v1",
      }
    } catch (error) {
      await step.run("mark-failed", async () => {
        await mergeCareerOsOnboardingState(userId, {
          module_1_3: {
            status: "failed",
            failedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          },
        })
      })
      throw error
    }
  },
)
