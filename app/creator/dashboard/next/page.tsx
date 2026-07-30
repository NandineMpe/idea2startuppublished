import { Lightbulb } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadNextFive, NEXT_FIVE_SIZE } from "@/lib/creator/load-next-five"
import { DraftCard } from "@/components/creator/draft-card"
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
      />

      {blocker && !drafts.length ? (
        <EmptyState
          icon={Lightbulb}
          title="No drafts yet"
          description="Every morning this holds five specific pieces, written against a format you have already proven and traceable to the posts that earned it."
          blocker={blocker}
        />
      ) : (
        <>
          {blocker && <BlockerNotice blocker={blocker} />}
          {drafts.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {drafts.map((draft) => (
                <DraftCard key={draft.id} draft={draft} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="Queue is empty"
              description={`Your canon is in place. The next run will fill this with ${NEXT_FIVE_SIZE} drafts.`}
            />
          )}
        </>
      )}
    </PageBody>
  )
}
