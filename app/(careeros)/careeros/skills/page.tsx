import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  SkillsPortfolioView,
  type PortfolioSkillRow,
} from "@/components/careeros/screens/skills-portfolio-view"
import { DEMO_SKILLS } from "@/lib/careeros/demo-data"

type HalfLifeData = {
  status: string | null
  half_life_months: number | null
  factors_payload: Record<string, unknown> | null
}

export default async function SkillsPortfolioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/career")

  const { data: skillRows, error } = await supabase
    .schema("careeros")
    .from("user_skills")
    .select(
      `id, skill_name, current_status, source_type,
       user_skill_half_life:current_half_life_id (
         status, half_life_months, factors_payload
       )`,
    )
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("skill_name", { ascending: true })

  if (error) {
    return (
      <div className="page-enter">
        <p className="body" style={{ color: "hsl(var(--destructive))" }}>
          Failed to load skills portfolio. Please try again.
        </p>
      </div>
    )
  }

  const skills: PortfolioSkillRow[] = (skillRows ?? []).map((row) => {
    const hlRaw = row.user_skill_half_life
    const hl =
      hlRaw && typeof hlRaw === "object" && !Array.isArray(hlRaw) ? (hlRaw as HalfLifeData) : null
    const status = hl?.status ?? (row.current_status as string | null)
    const demo = DEMO_SKILLS.find(
      (d) => d.name.toLowerCase() === String(row.skill_name).toLowerCase(),
    )
    const factors = hl?.factors_payload
    const exposure =
      factors && typeof factors.exposure_score === "number"
        ? Math.round((factors.exposure_score as number) * 100)
        : demo?.exposure ?? null

    return {
      id: row.id as string,
      name: row.skill_name as string,
      status,
      level: demo?.level ?? 65,
      halflife: hl?.half_life_months ?? demo?.halflife ?? null,
      exposure,
      trend: demo?.trend ?? [60, 62, 64, 66, 68, 70, 70, 70, 70, 70],
      cluster: demo?.cluster ?? "General",
      source: (row.source_type as string) ?? "resume",
    }
  })

  return <SkillsPortfolioView skills={skills} useDemoFallback={skills.length === 0} />
}
