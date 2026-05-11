import { createHash, randomUUID } from "crypto"
import { careerosMinIntervalMs } from "@/lib/careeros/integrations/rate-limits"
import {
  fetchOnetCareerSkillsFlat,
  getOnetAuthHeaders,
  onetSearchFirstOccupation,
} from "@/lib/careeros/integrations/onet-request"
import {
  mergeCareerOsModule14State,
  mergeCareerOsOnboardingState,
} from "@/lib/careeros/onboarding/user-settings"
import { supabaseAdmin } from "@/lib/supabase"
import { careerosInngest } from "../client"

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

/** Rough fuzzy score between user skill label and O*NET skill phrase (Content Model element label). */
function scoreSkillMatch(userLabel: string, onetName: string): number {
  const u = userLabel.toLowerCase().trim()
  const o = onetName.toLowerCase().trim()
  if (!u || !o) return 0
  if (u === o) return 1
  if (o.includes(u) || u.includes(o)) return 0.85
  const tokenize = (s: string) =>
    new Set(
      s
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    )
  const ut = tokenize(u)
  const ot = tokenize(o)
  if (ut.size === 0 || ot.size === 0) return 0
  let overlap = 0
  for (const t of ut) if (ot.has(t)) overlap++
  return overlap / Math.max(ut.size, ot.size)
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
        },
      })
    })

    try {
      if (!getOnetAuthHeaders()) {
        await step.run("skip-no-credentials", async () => {
          await mergeCareerOsOnboardingState(userId, {
            module_1_3: {
              status: "skipped",
              reason: "missing_onet_credentials",
              completedAt: new Date().toISOString(),
            },
          })
        })
        return { user_id: userId, skipped: true as const }
      }

      const profile = await step.run("load-profile", async () => {
        const { data, error } = await supabaseAdmin
          .schema("careeros")
          .from("user_profiles")
          .select("current_role_title,target_role_title")
          .eq("user_id", userId)
          .maybeSingle()
        if (error) throw error
        return data
      })

      const skillRows = await step.run("load-skills", async () => {
        const { data, error } = await supabaseAdmin
          .schema("careeros")
          .from("user_skills")
          .select("id,skill_name,canonical_skill_key,onet_skill_id")
          .eq("user_id", userId)
          .eq("is_active", true)
        if (error) throw error
        return (data ?? []).filter((r) => !r.onet_skill_id)
      })

      const keyword =
        (typeof profile?.current_role_title === "string" && profile.current_role_title.trim()) ||
        (typeof profile?.target_role_title === "string" && profile.target_role_title.trim()) ||
        "professional"

      await step.sleep("onet-pace-before-search", careerosMinIntervalMs("onet"))

      const search = await step.run("onet-search-occupation", async () =>
        onetSearchFirstOccupation(keyword),
      )

      if (!search.hit) {
        if (search.status === 401 || search.status === 403) {
          throw new Error(
            `O*NET rejected credentials (HTTP ${search.status}). Confirm ONET_USERNAME / ONET_PASSWORD in Vercel, or obtain ONET_API_KEY if migrating to Web Services v2.`,
          )
        }
        if (search.status >= 400) {
          throw new Error(`O*NET occupation search failed (HTTP ${search.status})`)
        }
        throw new Error("O*NET occupation search returned no matching SOC code for keyword")
      }

      const socCode = search.hit.soc_code

      await step.sleep("onet-pace-before-skills", careerosMinIntervalMs("onet"))

      const careerSkills = await step.run("onet-career-skills", async () =>
        fetchOnetCareerSkillsFlat(socCode),
      )

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

      const flat = careerSkills.skills
      let mapped = 0

      if (flat.length > 0 && skillRows.length > 0) {
        await step.run("apply-skill-mappings", async () => {
          for (const row of skillRows) {
            const skillName = row.skill_name as string
            const canon = typeof row.canonical_skill_key === "string" ? row.canonical_skill_key : ""
            const label = `${skillName} ${canon}`
            let best: { id: string; name: string; score: number } | null = null
            for (const s of flat) {
              const sc = Math.max(scoreSkillMatch(label, s.name), scoreSkillMatch(skillName, s.name))
              if (!best || sc > best.score) best = { id: s.id, name: s.name, score: sc }
            }
            if (best && best.score >= 0.38) {
              const { error } = await supabaseAdmin
                .schema("careeros")
                .from("user_skills")
                .update({
                  onet_skill_id: best.id,
                  onet_mapping_confidence: Number(best.score.toFixed(4)),
                  onet_mapping_payload: {
                    method: "occupation_skills_tree",
                    matched_name: best.name,
                    soc_code: socCode,
                  },
                })
                .eq("id", row.id as string)
              if (!error) mapped += 1
            }
          }
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
              onet_mapping_confidence: careerSkills.ok ? 0.72 : 0.42,
              onet_mapping_payload: {
                keyword,
                occupation_title: search.hit?.title ?? null,
                career_skills_fetch_ok: careerSkills.ok,
                career_skills_status: careerSkills.status,
                mapped_skill_rows: mapped,
              },
            },
            { onConflict: "user_id" },
          )
        if (error) throw error
      })

      const inputPayload = {
        user_id: userId,
        keyword,
        soc_code: socCode,
        skill_row_ids: skillRows.map((s) => s.id as string).sort(),
      }
      const inputHash = sha256Hex(JSON.stringify(inputPayload))

      await step.run("audit-generation-run", async () => {
        const { error } = await supabaseAdmin.schema("careeros").from("generation_runs").insert({
          id: randomUUID(),
          user_id: userId,
          artefact_table: "careeros.user_profiles",
          artefact_id: null,
          workflow_name: "careeros/profile.onet-map",
          provider: "other",
          model_name: "onet-web-services",
          model_version: "v2",
          prompt_version: "onet-keyword+career-skills",
          schema_version: "1",
          input_data_version: inputHash,
          source_attribution: { keyword, soc_code: socCode },
          input_hash: inputHash,
          output_hash: sha256Hex(JSON.stringify({ mapped, socCode, careerSkillsOk: careerSkills.ok })),
          latency_ms: null,
          token_usage: { career_skills_fetch_ok: careerSkills.ok, career_skills_status: careerSkills.status },
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
            careerSkillsFetchOk: careerSkills.ok,
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

      return {
        user_id: userId,
        soc_code: socCode,
        mapped_skills: mapped,
        career_skills_ok: careerSkills.ok,
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
