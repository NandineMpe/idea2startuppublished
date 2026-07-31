import { requireCreatorUser } from "@/lib/creator/auth"
import { loadCreatorSettings } from "@/lib/creator/load-settings"
import { loadRecycleBin } from "@/lib/creator/load-bin"
import { loadUsageSummary } from "@/lib/creator/ai/usage-summary"
import { UsagePanel } from "@/components/creator/usage-panel"
import { SettingsForm } from "@/components/creator/settings-form"
import { RecentlyDeleted } from "@/components/creator/recently-deleted"
import { BlockerNotice, PageBody, PageHeader } from "@/components/creator/page-shell"

export const dynamic = "force-dynamic"

export default async function CreatorSettingsPage() {
  const { supabase, userId } = await requireCreatorUser()
  const [{ settings, persisted }, binned, usage] = await Promise.all([
    loadCreatorSettings(supabase, userId),
    loadRecycleBin(supabase, userId),
    loadUsageSummary(supabase, userId),
  ])

  return (
    <PageBody>
      <PageHeader title="Settings" subtitle="The few inputs that are not derived from your content." />

      {!persisted && (
        <BlockerNotice
          blocker={{
            reason: "no_corpus",
            action:
              "The creator schema has not been migrated yet, so these show defaults and cannot be saved. The form goes live the moment the migration is applied.",
            href: null,
          }}
        />
      )}

      <SettingsForm settings={settings} persisted={persisted} />

      <UsagePanel summary={usage} />

      <RecentlyDeleted items={binned} />
    </PageBody>
  )
}
