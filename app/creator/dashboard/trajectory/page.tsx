import { requireCreatorUser } from "@/lib/creator/auth"
import { loadTrajectory } from "@/lib/creator/load-trajectory"
import { TrajectoryForm } from "@/components/creator/trajectory-form"
import { StrategyPanel } from "@/components/creator/strategy-panel"
import { PageBody, PageHeader } from "@/components/creator/page-shell"

export const dynamic = "force-dynamic"

export default async function TrajectoryPage() {
  const { supabase, userId } = await requireCreatorUser()
  const trajectory = await loadTrajectory(supabase, userId)

  return (
    <PageBody>
      <PageHeader
        title="Trajectory"
        subtitle="Your canon is where you have been. This is where you are going, and it is what the desk works toward."
      />

      <TrajectoryForm trajectory={trajectory} />

      {trajectory && <StrategyPanel trajectory={trajectory} />}
    </PageBody>
  )
}
