import { ReportProblemButton } from "@/components/careeros/report-problem-button"
import { CareerOsIcon } from "@/components/careeros/icon"
import { CareerOsBtn, CareerOsPageHeader, CareerOsPill, CareerOsStat } from "@/components/careeros/ui"
import { DEMO_PROFILE } from "@/lib/careeros/demo-data"

type SkillChip = {
  skill_name: string
  source_type: string
  onet_skill_id?: string | null
  onet_needs_review?: boolean
}

type PastRole = {
  title?: unknown
  company?: unknown
  start_date?: unknown
  end_date?: unknown
  note?: unknown
}

type Edu = {
  institution?: unknown
  degree?: unknown
  field_of_study?: unknown
  field?: unknown
  years?: unknown
}

export function CareerWorkspaceView({
  userEmail,
  profile,
  resumeSkills,
  linkedinSkills,
  markdownSkills,
  pastRoles,
  education,
  achievements,
  extractionId,
  extractionCreatedAt,
  extractionMethod,
  module12Status,
  extractionLooksEmpty,
  onetSocCode,
  onetMappingConfidence,
  skillsNeedingReview,
}: {
  userEmail: string | null
  profile: {
    current_role_title?: string | null
    years_experience?: number | null
    current_salary_usd?: number | null
    target_role_title?: string | null
    location_label?: string | null
  } | null
  resumeSkills: SkillChip[]
  linkedinSkills: SkillChip[]
  markdownSkills: SkillChip[]
  pastRoles: PastRole[]
  education: Edu[]
  achievements: string[]
  extractionId: string | null
  extractionCreatedAt: string | null
  extractionMethod: string | null
  module12Status: string
  extractionLooksEmpty: boolean
  onetSocCode: string | null
  onetMappingConfidence: number | null
  skillsNeedingReview: SkillChip[]
}) {
  const displayName =
    userEmail?.split("@")[0]?.replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
    DEMO_PROFILE.name
  const initials = displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const headline =
    profile?.current_role_title && profile?.target_role_title
      ? `${profile.years_experience ?? 3} years · ${profile.current_role_title} → ${profile.target_role_title}`
      : DEMO_PROFILE.headline

  return (
    <div className="page-enter">
      <CareerOsPageHeader
        eyebrow="CareerOS workspace"
        title="Your CareerOS profile"
        sub="Extracted from your resume, LinkedIn export, and career markdown. Tap report problem on any section to queue a correction."
        actions={
          <>
            <CareerOsBtn>
              <CareerOsIcon name="download" size={14} /> Export
            </CareerOsBtn>
            <CareerOsBtn href="/careeros/onboarding" primary>
              <CareerOsIcon name="upload" size={14} /> Re-upload
            </CareerOsBtn>
          </>
        }
      />

      {(module12Status === "running" || (module12Status === "completed" && !extractionId)) && (
        <div className="card padded" style={{ marginBottom: 22 }}>
          <p className="h-card">We&apos;re building your career profile</p>
          <p className="body" style={{ marginTop: 6 }}>
            This takes about 30 seconds. You can safely refresh this page.
          </p>
        </div>
      )}

      {extractionLooksEmpty && extractionId && (
        <div className="card padded" style={{ marginBottom: 22, borderColor: "hsl(var(--destructive) / 0.35)" }}>
          <p className="h-card">Extraction needs a retry</p>
          <p className="body" style={{ marginTop: 6 }}>
            Your documents saved, but the last pass returned almost no structured fields.
          </p>
          <CareerOsBtn href="/careeros/onboarding" primary sm className="!mt-3">
            Retry extraction
          </CareerOsBtn>
        </div>
      )}

      {extractionId && !extractionLooksEmpty && (
        <>
          <div className="card padded juno-halo" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
              <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: 22, fontWeight: 600 }}>{displayName}</h2>
                  <span className="small">{userEmail}</span>
                </div>
                <div className="body" style={{ marginTop: 6 }}>
                  {headline}
                </div>
                <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
                  <CareerOsStat
                    label="Current role"
                    value={profile?.current_role_title ?? "—"}
                    sub={DEMO_PROFILE.current_company}
                  />
                  <CareerOsStat
                    label="Years qualified"
                    value={profile?.years_experience != null ? `${profile.years_experience} yrs` : DEMO_PROFILE.pqe_label}
                    sub="experience"
                  />
                  <CareerOsStat
                    label="Target role"
                    value={profile?.target_role_title ?? DEMO_PROFILE.target_role_title}
                    sub="confirmed"
                    tone="primary"
                  />
                  <CareerOsStat
                    label="Location"
                    value={profile?.location_label ?? DEMO_PROFILE.location_label}
                    sub="primary geo"
                  />
                </div>
              </div>
              {extractionId && (
                <ReportProblemButton
                  extractionId={extractionId}
                  section="profile_summary"
                  fieldPath="current_role_title"
                  currentValue={profile}
                />
              )}
            </div>
          </div>

          {(onetSocCode || skillsNeedingReview.length > 0) && (
            <div className="card padded" style={{ marginBottom: 22 }}>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                O*NET mapping
              </p>
              {onetSocCode ? (
                <p className="body">
                  Occupation code: <span className="mono">{onetSocCode}</span>
                  {typeof onetMappingConfidence === "number"
                    ? ` · confidence ${Math.round(onetMappingConfidence * 100)}%`
                    : ""}
                </p>
              ) : (
                <p className="body">Occupation mapping pending. Check back after onboarding completes.</p>
              )}
              {skillsNeedingReview.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <p className="small" style={{ marginBottom: 8 }}>
                    {skillsNeedingReview.length} skill
                    {skillsNeedingReview.length === 1 ? "" : "s"} need review (novel or low-confidence match):
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {skillsNeedingReview.map((s) => (
                      <CareerOsPill key={`${s.skill_name}-${s.source_type}`} tone="declining">
                        {s.skill_name}
                      </CareerOsPill>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="career-os-split grid w-full items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,34%)]">
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {markdownSkills.length > 0 && (
                <SkillSection
                  title="Skills from your career profile (.md)"
                  sub={`${markdownSkills.length} skills · ${extractionMethod === "markdown_heuristic" ? "structured parse" : "LLM extract"}`}
                  skills={markdownSkills}
                  extractionId={extractionId}
                  fieldPath="llm_markdown"
                />
              )}

              <SkillSection
                title="Skills from your resume"
                sub={`${resumeSkills.length} skills · PDF upload`}
                skills={resumeSkills}
                extractionId={extractionId}
                fieldPath="resume"
              />

              <SkillSection
                title="Skills from LinkedIn"
                sub={`${linkedinSkills.length} skills · export`}
                skills={linkedinSkills}
                extractionId={extractionId}
                fieldPath="linkedin"
              />

              <RolesCard pastRoles={pastRoles} extractionId={extractionId} />
            </div>

            <aside style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <EducationCard education={education} extractionId={extractionId} />
              <AchievementsCard achievements={achievements} extractionId={extractionId} />
              <div className="card padded muted">
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  Extraction
                </div>
                <p className="small">
                  {extractionCreatedAt
                    ? `Generated ${new Date(extractionCreatedAt).toLocaleString()}`
                    : "Recent run"}
                </p>
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <CareerOsBtn href="/careeros/skills" sm>
                    Skill portfolio <CareerOsIcon name="arrow_right" size={12} />
                  </CareerOsBtn>
                  <CareerOsBtn href="/career/dashboard" ghost sm>
                    Dashboard
                  </CareerOsBtn>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}

      {!extractionId && module12Status !== "running" && (
        <div className="card padded">
          <p className="h-card">No extraction yet</p>
          <p className="body" style={{ marginTop: 6 }}>
            Complete onboarding to build your structured profile.
          </p>
          <CareerOsBtn href="/careeros/onboarding" primary sm className="!mt-3">
            Start onboarding
          </CareerOsBtn>
        </div>
      )}
    </div>
  )
}

function SkillSection({
  title,
  sub,
  skills,
  extractionId,
  fieldPath,
}: {
  title: string
  sub: string
  skills: SkillChip[]
  extractionId: string
  fieldPath: string
}) {
  return (
    <div className="card">
      <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div>
          <div className="h-card">{title}</div>
          <div className="small" style={{ marginTop: 4 }}>
            {sub}
          </div>
        </div>
        <ReportProblemButton
          extractionId={extractionId}
          section="skills"
          fieldPath={fieldPath}
          currentValue={skills}
        />
      </div>
      <div className="card-section">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {skills.map((s) => (
            <CareerOsPill key={s.skill_name}>
              {s.skill_name}
            </CareerOsPill>
          ))}
        </div>
      </div>
    </div>
  )
}

function RolesCard({
  pastRoles,
  extractionId,
}: {
  pastRoles: PastRole[]
  extractionId: string
}) {
  return (
    <div className="card">
      <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div>
          <div className="h-card">Past roles</div>
          <div className="small" style={{ marginTop: 4 }}>
            {pastRoles.length} roles
          </div>
        </div>
        <ReportProblemButton
          extractionId={extractionId}
          section="past_roles"
          fieldPath="past_roles"
          currentValue={pastRoles}
        />
      </div>
      {pastRoles.map((r, i) => (
        <div className="card-section" key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            className="icon-tile"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "hsl(var(--surface-2))",
              color: "hsl(var(--muted-foreground))",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CareerOsIcon name="building" size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{String(r.title ?? "Unknown role")}</div>
            <div className="small" style={{ marginTop: 1 }}>
              {String(r.company ?? "—")} · {String(r.start_date ?? "?")} – {String(r.end_date ?? "?")}
            </div>
          </div>
          {i === 0 && <CareerOsPill solid>Current</CareerOsPill>}
        </div>
      ))}
    </div>
  )
}

function EducationCard({ education, extractionId }: { education: Edu[]; extractionId: string }) {
  return (
    <div className="card">
      <div className="card-section">
        <div className="h-card">Education</div>
      </div>
      {education.map((edu, idx) => (
        <div className="card-section" key={idx}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{String(edu.institution ?? "—")}</div>
          <div className="small" style={{ marginTop: 2 }}>
            {String(edu.degree ?? "")}
            {(edu.field_of_study ?? edu.field) ? ` · ${String(edu.field_of_study ?? edu.field)}` : ""}
          </div>
        </div>
      ))}
      <div className="card-section">
        <ReportProblemButton
          extractionId={extractionId}
          section="education"
          fieldPath="education"
          currentValue={education}
        />
      </div>
    </div>
  )
}

function AchievementsCard({
  achievements,
  extractionId,
}: {
  achievements: string[]
  extractionId: string
}) {
  return (
    <div className="card">
      <div className="card-section">
        <div className="h-card">Notable achievements</div>
      </div>
      <div className="card-section">
        <ul className="body" style={{ paddingLeft: 18, margin: 0 }}>
          {achievements.map((item) => (
            <li key={item} style={{ marginBottom: 8 }}>
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="card-section">
        <ReportProblemButton
          extractionId={extractionId}
          section="notable_achievements"
          fieldPath="notable_achievements"
          currentValue={achievements}
        />
      </div>
    </div>
  )
}
