import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  let module12Complete = false
  let topSkills: string[] = []
  let suggestedRoles: string[] = []
  let skillsCount: number | null = null

  if (user) {
    const { data: row } = await supabase
      .schema("careeros")
      .from("user_settings")
      .select("onboarding_state")
      .eq("user_id", user.id)
      .maybeSingle()

    const onboarding = row?.onboarding_state as Record<string, unknown> | null | undefined
    const m11 =
      onboarding &&
      typeof onboarding.module_1_1 === "object" &&
      onboarding.module_1_1 !== null
        ? (onboarding.module_1_1 as Record<string, unknown>)
        : undefined
    module11Complete = m11?.module_1_1_complete === true

    const m12 =
      m11 &&
      typeof m11.module_1_2 === "object" &&
      m11.module_1_2 !== null
        ? (m11.module_1_2 as Record<string, unknown>)
        : null

    module12Complete = m12?.status === "completed"
    topSkills = asStringList(m12?.topSkills)
    suggestedRoles = asStringList(m12?.suggestedRoles)
    const sc = m12?.skillsCount
    skillsCount = typeof sc === "number" ? sc : null

    if (module12Complete && topSkills.length === 0) {
      const { data: inferred } = await supabase
        .schema("careeros")
        .from("user_skills")
        .select("skill_name")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .eq("source_type", "inferred")
        .order("proficiency_score", { ascending: false })
        .limit(8)

      topSkills = (inferred ?? []).map((r) => r.skill_name as string).filter(Boolean)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CareerOS</p>
      <h1 className="text-3xl font-semibold text-foreground">
        {module11Complete ? "Your CareerOS workspace" : "Welcome to CareerOS"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {module12Complete ? (
          <>
            Module 1.1 and Module 1.2 are complete — your documents, profile fields, and inferred
            skills are stored. You can refine inputs anytime from onboarding.
          </>
        ) : module11Complete ? (
          <>
            Module 1.1 onboarding is complete — your documents and profile fields are stored. Finish
            the confirmation step in onboarding to run skill extraction (Module 1.2).
          </>
        ) : (
          <>
            Upload resume context and confirm your role in a short flow (Module 1.1). After that,
            you&apos;ll see the &quot;building your career profile&quot; step while we extract skills
            from your materials (Module 1.2).
          </>
        )}
      </p>

      {module12Complete ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Extraction complete</CardTitle>
            <CardDescription>
              Top skills inferred from your onboarding documents
              {typeof skillsCount === "number" ? ` (${skillsCount} total)` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topSkills.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {topSkills.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-foreground"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No skill labels were returned; try re-running extraction from onboarding or add more
                document context.
              </p>
            )}
            {suggestedRoles.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Role signals
                </p>
                <ul className="list-inside list-disc text-sm text-muted-foreground">
                  {suggestedRoles.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        {module11Complete ? (
          <Link href="/careeros/onboarding" className="text-sm text-muted-foreground hover:underline">
            Review or update onboarding inputs
          </Link>
        ) : (
          <Link href="/careeros/onboarding" className="text-sm text-primary hover:underline">
            Start onboarding (Module 1.1)
          </Link>
        )}
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          Return to dashboard
        </Link>
      </div>
    </main>
  )
}
