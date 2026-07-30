import type { SupabaseClient } from "@supabase/supabase-js"

export type CareerDashboardSkill = {
  skill_name: string
  current_status: string | null
  source_type: string
}

export type CareerDashboardContext = {
  profile: {
    current_role_title: string | null
    target_role_title: string | null
    location_label: string | null
    years_experience: number | null
  } | null
  onboardingComplete: boolean
  extractionStatus: "idle" | "running" | "completed" | "failed"
  extractionId: string | null
  topSkillsFromExtraction: string[]
  skills: CareerDashboardSkill[]
  profileHeadline: string | null
  profileSubtitle: string | null
  showProfileActive: boolean
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
}

function formatProfileHeadline(profile: CareerDashboardContext["profile"]): string | null {
  if (!profile?.current_role_title?.trim()) return null
  const parts = [profile.current_role_title.trim()]
  if (profile.target_role_title?.trim()) {
    parts.push(`→ ${profile.target_role_title.trim()}`)
  }
  if (profile.location_label?.trim()) {
    parts.push(`· ${profile.location_label.trim()}`)
  }
  return parts.join(" ")
}

/**
 * Loads CareerOS home dashboard data from the onboarded user's profile and extraction,
 * not demo or inferred placeholder skills.
 */
export async function loadCareerDashboardContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<CareerDashboardContext> {
  const [{ data: profile }, { data: settings }, { data: skillRows }, { data: extractionRow }] =
    await Promise.all([
      supabase
        .schema("careeros")
        .from("user_profiles")
        .select(
          "current_role_title,target_role_title,location_label,years_experience,last_profile_extraction_id,profile_ready_at",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .schema("careeros")
        .from("user_settings")
        .select("onboarding_state")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .schema("careeros")
        .from("v_user_portfolio_skills")
        .select("skill_name,current_status,source_type")
        .eq("user_id", userId)
        .order("skill_name", { ascending: true }),
      supabase
        .schema("careeros")
        .from("user_document_extractions")
        .select("id,created_at")
        .eq("user_id", userId)
        .eq("parser_name", "careeros-profile-extract")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const onboardingState = (settings?.onboarding_state as Record<string, unknown> | null) ?? {}
  const module11 = (onboardingState.module_1_1 as Record<string, unknown> | null) ?? {}
  const module12 = (module11.module_1_2 as Record<string, unknown> | null) ?? {}

  const onboardingComplete = module11.module_1_1_complete === true

  const rawStatus = module12.status
  const extractionStatus: CareerDashboardContext["extractionStatus"] =
    rawStatus === "running" || rawStatus === "completed" || rawStatus === "failed"
      ? rawStatus
      : extractionRow?.id
        ? "completed"
        : "idle"

  const extractionId =
    (typeof module12.extractionId === "string" ? module12.extractionId : null) ??
    (profile?.last_profile_extraction_id as string | undefined) ??
    (extractionRow?.id as string | undefined) ??
    null

  const topSkillsFromExtraction = asStringList(module12.topSkills)

  const documentSkills: CareerDashboardSkill[] = (skillRows ?? []).map((s) => ({
    skill_name: String(s.skill_name),
    current_status: (s.current_status as string | null) ?? null,
    source_type: String(s.source_type),
  }))

  const topSet = new Set(topSkillsFromExtraction.map((s) => s.toLowerCase()))
  const orderedSkills =
    topSkillsFromExtraction.length > 0
      ? [
          ...topSkillsFromExtraction
            .map((name) => documentSkills.find((s) => s.skill_name.toLowerCase() === name.toLowerCase()))
            .filter((s): s is CareerDashboardSkill => Boolean(s)),
          ...documentSkills.filter((s) => !topSet.has(s.skill_name.toLowerCase())),
        ]
      : documentSkills

  const skills = orderedSkills.slice(0, 8)

  const profileRecord = profile
    ? {
        current_role_title: (profile.current_role_title as string | null) ?? null,
        target_role_title: (profile.target_role_title as string | null) ?? null,
        location_label: (profile.location_label as string | null) ?? null,
        years_experience:
          typeof profile.years_experience === "number" ? profile.years_experience : null,
      }
    : null

  const profileHeadline = formatProfileHeadline(profileRecord)

  let profileSubtitle: string | null = null
  if (extractionStatus === "running") {
    profileSubtitle = "Building your profile from your resume and LinkedIn…"
  } else if (extractionStatus === "failed") {
    profileSubtitle = "Profile extraction failed. Retry from onboarding to refresh your skills."
  } else if (onboardingComplete && skills.length === 0 && extractionStatus !== "completed") {
    profileSubtitle = "Finish onboarding so we can extract skills from your documents."
  } else if (extractionStatus === "completed" && skills.length === 0) {
    profileSubtitle = "No skills were found in your documents. Review your profile on CareerOS."
  }

  const profileReadyAt = profile?.profile_ready_at as string | null | undefined
  const showProfileActive =
    onboardingComplete &&
    extractionStatus === "completed" &&
    Boolean(extractionId) &&
    Boolean(profileReadyAt) &&
    skills.length > 0

  return {
    profile: profileRecord,
    onboardingComplete,
    extractionStatus,
    extractionId,
    topSkillsFromExtraction,
    skills,
    profileHeadline,
    profileSubtitle,
    showProfileActive,
  }
}
