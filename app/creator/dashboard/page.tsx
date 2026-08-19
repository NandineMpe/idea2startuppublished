import type React from "react"
import { AlertTriangle, CheckCircle2, Inbox, Sunrise } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadDesk } from "@/lib/creator/load-desk"
import { ConfidenceBadge } from "@/components/creator/confidence-badge"
import { DecideButtons } from "@/components/creator/decide-buttons"
import { ItemActions } from "@/components/creator/item-actions"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { EmptyState, PageBody, PageHeader, StatTile } from "@/components/creator/page-shell"
import type { CreatorWorkItem } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

function relative(iso: string | null): string {
  if (!iso) return "never"
  const diffMinutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)}h ago`
  return `${Math.round(diffMinutes / 1440)}d ago`
}

function WorkRow({ item, decidable = false }: { item: CreatorWorkItem; decidable?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground leading-snug">{item.title}</p>
        {item.rationale && (
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">{item.rationale}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {item.provenance.agent} · {relative(item.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {decidable && <DecideButtons workId={item.id} />}
        <ItemActions entity="work" id={item.id} noun="item" />
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  items,
  emptyLine,
  decidable = false,
}: {
  title: string
  icon: React.ElementType
  items: CreatorWorkItem[]
  emptyLine: string
  decidable?: boolean
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
      </div>

      {items.length ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {items.map((item) => (
            <WorkRow key={item.id} item={item} decidable={decidable} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-4 py-5">
          <p className="text-[12px] text-muted-foreground">{emptyLine}</p>
        </div>
      )}
    </section>
  )
}

export default async function CreatorDeskPage() {
  const { supabase, userId } = await requireCreatorUser()
  const desk = await loadDesk(supabase, userId)

  if (desk.blocker) {
    return (
      <PageBody>
        <PageHeader title="The Desk" subtitle="What your last run turned up, and what needs you." />
        <EmptyState
          icon={Sunrise}
          title="Nothing has run yet"
          description="The Desk reports on the last time you sent the agents out. They need a corpus to work from before there is anything to report."
          blocker={desk.blocker}
        />
      </PageBody>
    )
  }

  return (
    <PageBody>
      <PageHeader
        title="The Desk"
        subtitle="What your last run turned up, and what needs you. Nothing runs on a schedule, so this changes when you send the agents out and not before."
        actions={
          <div className="flex items-center gap-2">
            {/* The whole point of manual runs: one button for someone who has
                been away, so catching up is a decision rather than a checklist. */}
            <RunAgentButton kind="everything" label="Run everything" variant="primary" />
            <RunAgentButton kind="research" label="Researcher only" />
            {desk.canon ? (
              <ConfidenceBadge confidence={desk.canon.confidence} sampleSize={desk.canon.corpus_size} />
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <StatTile label="Corpus" value={String(desk.corpus.total_posts)} hint="posts ingested" />
        <StatTile
          label="Transcribed"
          value={`${desk.corpus.transcribed}/${desk.corpus.total_posts}`}
          hint={desk.corpus.awaiting_transcript ? `${desk.corpus.awaiting_transcript} pending` : "complete"}
        />
        <StatTile
          label="Canon"
          value={desk.canon ? `v${desk.canon.version}` : "—"}
          hint={desk.canon ? relative(desk.canon.derived_at) : "not derived"}
        />
        <StatTile
          label="Last run"
          value={relative(desk.last_run_at)}
          hint={desk.last_run_at ? "nothing runs unless you say so" : "never run"}
        />
      </div>

      {/* Escalations and approvals are a queue and are never aged out, however
          long the gap between runs. The report below them is one run's worth. */}
      <Section
        title="Escalations"
        icon={AlertTriangle}
        items={desk.escalations}
        emptyLine="Nothing stuck. Agents escalate when the stakes are high or they cannot proceed."
      />

      <Section
        title="Awaiting you"
        icon={Inbox}
        items={desk.awaiting}
        emptyLine="No decisions queued. Anything leaving your account waits here for approval, and it waits as long as it takes."
        decidable
      />

      <Section
        title="From your last run"
        icon={CheckCircle2}
        items={desk.completed}
        emptyLine="No completed work yet. Run everything above and it lands here."
      />
    </PageBody>
  )
}
