import { createClient } from "@/lib/supabase/server"
import { CareerWorkspaceView } from "@/components/careeros/screens/workspace-view"

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
}

export default async function CareerOSPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let module12Status: "idle" | "running" | "completed" | "failed" = "idle"
  let extractionId: string | null = null
  let extractionCreatedAt: string | null = null
  let extractionMethod: string | null = null
  let extractionPayload: Record<string, unknown> | null = null
  let latestRunStatus: string | null = null

  let profile: {
    current_role_title?: string | null
    years_experience?: number | null
    current_salary_usd?: number | null
    target_role_title?: string | null
    location_label?: string | null
    onet_soc_code?: string | null
    onet_mapping_confidence?: number | null
  } | null = null
  let skillRows: Array<{
    skill_name: string
    source_type: string
    onet_skill_id?: string | null
    onet_needs_review?: boolean
  }> = []

  if (user) {
    const [{ data: settings }, { data: profileRow }, { data: extractionRow }, { data: skills }, { data: latestRun }] =
      await Promise.all([
        supabase
          .schema("careeros")
          .from("user_settings")
          .select("onboarding_state")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .schema("careeros")
          .from("user_profiles")
          .select(
            "current_role_title,years_experience,current_salary_usd,target_role_title,location_label,onet_soc_code,onet_mapping_confidence",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .schema("careeros")
          .from("user_document_extractions")
          .select("id,parsed_payload,created_at,extraction_method")
          .eq("user_id", user.id)
          .eq("parser_name", "careeros-profile-extract")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("careeros")
          .from("user_skills")
          .select("skill_name,source_type,onet_skill_id,onet_needs_review")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("skill_name", { ascending: true }),
        supabase
          .schema("careeros")
          .from("generation_runs")
          .select("status,created_at")
          .eq("user_id", user.id)
          .eq("workflow_name", "careeros/profile.extract")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const onboarding = settings?.onboarding_state as Record<string, unknown> | null | undefined
    const m11 =
      onboarding &&
      typeof onboarding.module_1_1 === "object" &&
      onboarding.module_1_1 !== null
        ? (onboarding.module_1_1 as Record<string, unknown>)
        : undefined

    const module12 =
      m11 && typeof m11.module_1_2 === "object" && m11.module_1_2 !== null
        ? (m11.module_1_2 as Record<string, unknown>)
        : null

    const rawStatus = module12?.status
    if (rawStatus === "running" || rawStatus === "completed" || rawStatus === "failed") {
      module12Status = rawStatus
    }

    profile = profileRow ?? null
    extractionId = (extractionRow?.id as string | undefined) ?? null
    extractionCreatedAt = (extractionRow?.created_at as string | undefined) ?? null
    extractionPayload = (extractionRow?.parsed_payload as Record<string, unknown> | undefined) ?? null
    extractionMethod = (extractionRow?.extraction_method as string | undefined) ?? null
    latestRunStatus = (latestRun?.status as string | undefined) ?? null
    skillRows = (skills ?? []) as Array<{
      skill_name: string
      source_type: string
      onet_skill_id?: string | null
      onet_needs_review?: boolean
    }>

    if (latestRunStatus === "failed" && module12Status !== "failed") {
      module12Status = "failed"
    }
  }

  const extractionPastRoles = Array.isArray(extractionPayload?.past_roles)
    ? (extractionPayload?.past_roles as Array<Record<string, unknown>>)
    : []
  const extractionEducation = Array.isArray(extractionPayload?.education)
    ? (extractionPayload?.education as Array<Record<string, unknown>>)
    : []
  const extractionAchievements = asStringList(extractionPayload?.notable_achievements)

  const resumeSkills = skillRows.filter((s) => s.source_type === "resume")
  const linkedinSkills = skillRows.filter((s) => s.source_type === "linkedin")
  const markdownSkills = skillRows.filter((s) => s.source_type === "llm_markdown")
  const extractionSkills = Array.isArray(extractionPayload?.skills)
    ? (extractionPayload.skills as Array<{ skill_name?: string; source_type?: string }>)
    : []
  const markdownSkillsFromPayload = extractionSkills.filter(
    (s) => s.source_type === "llm_markdown" && typeof s.skill_name === "string",
  )
  const displayMarkdownSkills =
    markdownSkills.length > 0
      ? markdownSkills
      : markdownSkillsFromPayload.map((s) => ({
          skill_name: s.skill_name as string,
          source_type: "llm_markdown",
        }))

  const extractionLooksEmpty =
    extractionMethod === "fallback_minimal" &&
    resumeSkills.length === 0 &&
    linkedinSkills.length === 0 &&
    displayMarkdownSkills.length === 0 &&
    extractionPastRoles.length === 0

  return (
    <CareerWorkspaceView
      userEmail={user?.email ?? null}
      profile={profile}
      resumeSkills={resumeSkills}
      linkedinSkills={linkedinSkills}
      markdownSkills={displayMarkdownSkills}
      pastRoles={extractionPastRoles}
      education={extractionEducation}
      achievements={extractionAchievements}
      extractionId={extractionId}
      extractionCreatedAt={extractionCreatedAt}
      extractionMethod={extractionMethod}
      module12Status={module12Status}
      extractionLooksEmpty={extractionLooksEmpty}
      onetSocCode={profile?.onet_soc_code ?? null}
      onetMappingConfidence={profile?.onet_mapping_confidence ?? null}
      skillsNeedingReview={skillRows.filter((s) => s.onet_needs_review || !s.onet_skill_id)}
    />
  )
}
