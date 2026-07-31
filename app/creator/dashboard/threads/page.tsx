import { Archive, Eye, History, TrendingUp } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadThreads } from "@/lib/creator/load-threads"
import { ThreadCard } from "@/components/creator/thread-card"
import { ThreadsPanel } from "@/components/creator/threads-panel"
import { Disclosure } from "@/components/creator/disclosure"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"
import type { CreatorThread } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

function Section({
  title,
  icon: Icon,
  hint,
  threads,
}: {
  title: string
  icon: React.ElementType
  hint: string
  threads: CreatorThread[]
}) {
  if (!threads.length) return null
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">{threads.length}</span>
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      </div>
      <div className="grid gap-4">
        {threads.map((thread) => (
          <ThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    </section>
  )
}

export default async function ThreadsPage() {
  const { supabase, userId } = await requireCreatorUser()
  const context = await loadThreads(supabase, userId)

  const all = [...context.moved, ...context.watching, ...context.dormant]
  const due = all.filter((t) => new Date(t.next_check_at) <= new Date()).length

  return (
    <PageBody>
      <PageHeader
        title="Open files"
        subtitle="Things you covered that were not over. The rest of the world stopped checking; this is where you do not."
      />

      {context.blocker && <BlockerNotice blocker={context.blocker} />}

      <ThreadsPanel counts={{ total: all.length, due }} />

      {!all.length ? (
        <EmptyState
          icon={History}
          title="No open files yet"
          description="Every post you have published is a claim made on a date about something unfinished. Open the files and the desk will go back to the primary record and find out what happened to each one."
          blocker={context.blocker}
        />
      ) : (
        <>
          <Section
            title="Moved"
            icon={TrendingUp}
            hint="something happened since you covered it"
            threads={context.moved}
          />
          <Section
            title="Still open"
            icon={Eye}
            hint="checked, nothing has moved yet"
            threads={context.watching}
          />

          {context.dormant.length > 0 && (
            <section>
              <Disclosure label="Gone quiet" count={context.dormant.length}>
                <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                  Checked several times with nothing found. Still checked, just far less often. A
                  story going quiet for a year and then landing is a normal shape, and it is the
                  shape nobody else is positioned to catch.
                </p>
                <div className="grid gap-4">
                  {context.dormant.map((thread) => (
                    <ThreadCard key={thread.id} thread={thread} />
                  ))}
                </div>
              </Disclosure>
            </section>
          )}
        </>
      )}
    </PageBody>
  )
}
