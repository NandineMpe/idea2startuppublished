import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportProblemButton } from "@/components/careeros/report-problem-button"
import { createClient } from "@/lib/supabase/server"

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
}

export default async function CareerOSPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let module11Complete = false
  let module12Status: "idle" | "running" | "completed" | "failed" = "idle"
  let module12Error: string | null = null

  let extractionId: string | null = null
  let extractionCreatedAt: string | null = null
  let extractionPayload: Record<string, unknown> | null = null
  let latestRunStatus: string | null = null

  let profile: {
    current_role_title?: string | null
    years_experience?: number | null
    current_salary_usd?: number | null
    target_role_title?: string | null
    location_label?: string | null
  } | null = null
  let skillRows: Array<{ skill_name: string; source_type: string }> = []

  let topSkills: string[] = []
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
          .select("current_role_title,years_experience,current_salary_usd,target_role_title,location_label")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .schema("careeros")
          .from("user_document_extractions")
          .select("id,parsed_payload,created_at")
          .eq("user_id", user.id)
          .eq("parser_name", "careeros-profile-extract")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .schema("careeros")
          .from("user_skills")
          .select("skill_name,source_type")
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
    module11Complete = m11?.module_1_1_complete === true

    const module12 =
      m11 &&
      typeof m11.module_1_2 === "object" &&
      m11.module_1_2 !== null
        ? (m11.module_1_2 as Record<string, unknown>)
        : null

    const rawStatus = module12?.status
    if (rawStatus === "running" || rawStatus === "completed" || rawStatus === "failed") {
      module12Status = rawStatus
    }
    module12Error = typeof module12?.error === "string" ? module12.error : null

    profile = profileRow ?? null
    extractionId = (extractionRow?.id as string | undefined) ?? null
    extractionCreatedAt = (extractionRow?.created_at as string | undefined) ?? null
    extractionPayload = (extractionRow?.parsed_payload as Record<string, unknown> | undefined) ?? null
    latestRunStatus = (latestRun?.status as string | undefined) ?? null
    skillRows = (skills ?? []) as Array<{ skill_name: string; source_type: string }>
    topSkills = asStringList(module12?.topSkills)

    if (topSkills.length === 0) {
      topSkills = skillRows.map((s) => s.skill_name).slice(0, 8)
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

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CareerOS</p>
      <h1 className="text-3xl font-semibold text-foreground">
        {module11Complete ? "Your CareerOS workspace" : "Welcome to CareerOS"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {module12Status === "completed" ? (
          <>
            Profile extraction is complete. Review the structured profile below and report any
            incorrect fields so we can improve future passes.
          </>
        ) : module12Status === "running" || (module11Complete && !extractionId) ? (
          <>
            We&apos;re building your career profile. This usually takes around 30 seconds after
            onboarding submit.
          </>
        ) : module12Status === "failed" || latestRunStatus === "failed" ? (
          <>Extraction failed on the latest run. Retry from onboarding to generate a fresh profile.</>
        ) : (
          <>
            Upload resume context and confirm your role in a short flow (Module 1.1). After that,
            you&apos;ll see the &quot;building your career profile&quot; step while we extract skills
            from your materials (Module 1.2).
          </>
        )}
      </p>

      {(module12Status === "running" || (module11Complete && !extractionId)) && (
        <Card>
          <CardHeader>
            <CardTitle>We&apos;re building your career profile</CardTitle>
            <CardDescription>This takes about 30 seconds. You can safely refresh this page.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {(module12Status === "failed" || latestRunStatus === "failed") && (
        <Card>
          <CardHeader>
            <CardTitle>Profile extraction failed</CardTitle>
            <CardDescription>
              {module12Error ?? "The latest extraction run failed."} Use retry to queue a fresh run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/careeros/onboarding" className="text-sm text-primary hover:underline">
              Retry extraction from onboarding
            </Link>
          </CardContent>
        </Card>
      )}

      {extractionId && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Extraction complete</CardTitle>
              <CardDescription>
                Generated {extractionCreatedAt ? new Date(extractionCreatedAt).toLocaleString() : "recently"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Detected role:{" "}
                <span className="font-medium text-foreground">
                  {profile?.current_role_title || "Not available"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Years experience:{" "}
                <span className="font-medium text-foreground">
                  {typeof profile?.years_experience === "number" ? profile.years_experience : "Not available"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Current salary (USD):{" "}
                <span className="font-medium text-foreground">
                  {typeof profile?.current_salary_usd === "number"
                    ? profile.current_salary_usd.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })
                    : "Not provided"}
                </span>
              </p>
              <ReportProblemButton
                extractionId={extractionId}
                section="profile_summary"
                fieldPath="current_role_title"
                currentValue={{
                  current_role_title: profile?.current_role_title ?? null,
                  years_experience: profile?.years_experience ?? null,
                  current_salary_usd: profile?.current_salary_usd ?? null,
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Skills from your resume</CardTitle>
              <CardDescription>Source attribution: extracted from your resume.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {(resumeSkills.length > 0 ? resumeSkills : topSkills.map((skill_name) => ({ skill_name } as const))).map((s) => (
                  <li key={s.skill_name} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm">
                    {s.skill_name}
                  </li>
                ))}
              </ul>
              <ReportProblemButton
                extractionId={extractionId}
                section="skills"
                fieldPath="resume"
                currentValue={resumeSkills}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Skills from LinkedIn</CardTitle>
              <CardDescription>Source attribution: extracted from your LinkedIn text.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="flex flex-wrap gap-2">
                {linkedinSkills.map((s) => (
                  <li key={s.skill_name} className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm">
                    {s.skill_name}
                  </li>
                ))}
              </ul>
              <ReportProblemButton
                extractionId={extractionId}
                section="skills"
                fieldPath="linkedin"
                currentValue={linkedinSkills}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Past roles</CardTitle>
              <CardDescription>Source attribution: extracted from resume/LinkedIn work history.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {extractionPastRoles.map((role, idx) => (
                  <li key={`${String(role.title)}-${idx}`} className="rounded border border-border p-3 text-sm">
                    <p className="font-medium">
                      {String(role.title ?? "Unknown role")} — {String(role.company ?? "Unknown company")}
                    </p>
                    <p className="text-muted-foreground">
                      {String(role.start_date ?? "?")} to {String(role.end_date ?? "?")}
                    </p>
                  </li>
                ))}
              </ul>
              <ReportProblemButton
                extractionId={extractionId}
                section="past_roles"
                fieldPath="past_roles"
                currentValue={extractionPastRoles}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Education</CardTitle>
              <CardDescription>Source attribution: extracted from resume/LinkedIn education sections.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {extractionEducation.map((edu, idx) => (
                  <li key={`${String(edu.institution)}-${idx}`} className="rounded border border-border p-3 text-sm">
                    <p className="font-medium">{String(edu.institution ?? "Unknown institution")}</p>
                    <p className="text-muted-foreground">
                      {String(edu.degree ?? "Unknown degree")}
                      {edu.field_of_study ? ` • ${String(edu.field_of_study)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
              <ReportProblemButton
                extractionId={extractionId}
                section="education"
                fieldPath="education"
                currentValue={extractionEducation}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Notable achievements</CardTitle>
              <CardDescription>Source attribution: direct mentions in your submitted documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {extractionAchievements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <ReportProblemButton
                extractionId={extractionId}
                section="notable_achievements"
                fieldPath="notable_achievements"
                currentValue={extractionAchievements}
              />
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <Link href="/careeros/health-report" className="text-sm text-primary hover:underline">
          Career Health Report
        </Link>
        <Link href="/careeros/feed" className="text-sm text-primary hover:underline">
          Open AI Updates Feed
        </Link>
        {module11Complete ? (
          <Link href="/careeros/onboarding" className="text-sm text-muted-foreground hover:underline">
            Review or update onboarding inputs
          </Link>
        ) : (
          <Link href="/careeros/onboarding" className="text-sm text-primary hover:underline">
            Start onboarding (Module 1.1)
          </Link>
        )}
        <Link href="/career/dashboard" className="text-sm text-muted-foreground hover:underline">
          Return to dashboard
        </Link>
      </div>
    </main>
  )
}
