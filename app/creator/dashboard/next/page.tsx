import { Lightbulb } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadNextFive } from "@/lib/creator/load-next-five"
import { DraftCard } from "@/components/creator/draft-card"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"

export const dynamic = "force-dynamic"

export default async function NextFivePage() {
  const { supabase, userId } = await requireCreatorUser()
  const { drafts, blocker } = await loadNextFive(supabase, userId)

  return (
    <PageBody>
      <PageHeader
        title="Next Five"
        subtitle="Drafted, in your voice, against formats that already work for you."
        actions={<RunAgentButton kind="writer" label="Write a draft" variant="primary" withBrief />}
      />

      {blocker && !drafts.length ? (
        <EmptyState
          icon={Lightbulb}
          title="No drafts yet"
          description="Drafts are written against a format you have already proven and stay traceable to the posts that earned it."
          blocker={blocker}
        />
      ) : (
        <>
          {blocker && <BlockerNotice blocker={blocker} />}
          {drafts.length ? (
            <div className="grid gap-4 max-w-[820px]">
              {drafts.map((draft) => (
                <DraftCard key={draft.id} draft={draft} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="Queue is empty"
              description="The Writer is commissioned, not scheduled — it runs when you approve a story on Stories, or when you ask for a draft directly with the button above."
            />
          )}
        </>
      )}
    </PageBody>
  )
}
