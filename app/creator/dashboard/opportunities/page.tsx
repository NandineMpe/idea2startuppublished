import type React from "react"
import { CheckCircle2, Handshake, Inbox, Mic2 } from "lucide-react"
import { requireCreatorUser } from "@/lib/creator/auth"
import { loadOpportunities } from "@/lib/creator/load-stories"
import { DecideButtons } from "@/components/creator/decide-buttons"
import { RunAgentButton } from "@/components/creator/run-agent-button"
import { BriefReplyPanel } from "@/components/creator/brief-reply"
import { MovesPanel } from "@/components/creator/moves-panel"
import { Disclosure } from "@/components/creator/disclosure"
import { BlockerNotice, EmptyState, PageBody, PageHeader } from "@/components/creator/page-shell"
import type { CreatorWorkItem } from "@/lib/creator/types"

export const dynamic = "force-dynamic"

type OpportunityProvenance = {
  lane?: string
  evidence_urls?: string[]
}

function OpportunityCard({ item, showDecision }: { item: CreatorWorkItem; showDecision: boolean }) {
  const provenance = item.provenance as OpportunityProvenance
  const evidence = provenance.evidence_urls ?? []

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {item.kind === "event" ? (
              <Mic2 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            ) : (
              <Handshake className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            )}
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.kind === "event" ? "Event" : "Deal"}
              {provenance.lane ? ` · ${provenance.lane}` : ""}
            </span>
          </div>
          <h3 className="text-[14px] font-semibold text-foreground leading-snug">{item.title}</h3>
          {item.rationale && (
            <p className="text-[12px] text-muted-foreground mt-1.5 leading-relaxed">{item.rationale}</p>
          )}
        </div>
        {showDecision && <DecideButtons workId={item.id} />}
      </div>

      {(item.body || evidence.length > 0) && (
        <div className="mt-3">
          <Disclosure label="Drafted pitch and sources">
            {item.body && (
              <div className="rounded-lg bg-muted/40 border border-border px-4 py-3">
                <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {item.body}
                </p>
              </div>
            )}

            {evidence.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {evidence.slice(0, 4).map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline break-all"
                  >
                    {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                  </a>
                ))}
              </div>
            )}
          </Disclosure>
        </div>
      )}
    </article>
  )
}

function Column({
  title,
  icon: Icon,
  items,
  emptyLine,
  showDecision,
}: {
  title: string
  icon: React.ElementType
  items: CreatorWorkItem[]
  emptyLine: string
  showDecision: boolean
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      {items.length ? (
        <div className="grid gap-4">
          {items.map((item) => (
            <OpportunityCard key={item.id} item={item} showDecision={showDecision} />
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

export default async function OpportunitiesPage() {
  const { supabase, userId } = await requireCreatorUser()
  const context = await loadOpportunities(supabase, userId)

  const empty = !context.proposed.length && !context.active.length && !context.done.length

  return (
    <PageBody>
      <PageHeader
        title="Opportunities"
        subtitle="Deals, events and platform listings your partnerships desk surfaced — each with the pitch already drafted."
        actions={<RunAgentButton kind="opportunities" label="Hunt now" variant="primary" />}
      />

      {context.blocker && <BlockerNotice blocker={context.blocker} />}

      {/* Inbound briefs arrive whether or not the hunting agents have run, so
          this sits above the pipeline rather than inside its empty state. */}
      <BriefReplyPanel />

      {/* Above the deal pipeline on purpose: what to build compounds, whereas a
          single sponsored post does not, and the pipeline is the noisier list. */}
      <MovesPanel moves={context.moves} />

      {empty ? (
        <EmptyState
          icon={Handshake}
          title="Nothing surfaced yet"
          description="The partnerships desk hunts every morning across brands already sponsoring your niche, events looking for speakers, and marketplaces you should be listed on."
          blocker={context.blocker}
        />
      ) : (
        <>
          <Column
            title="Awaiting you"
            icon={Inbox}
            items={context.proposed}
            emptyLine="No new opportunities awaiting a decision."
            showDecision
          />
          <Column
            title="Approved / in motion"
            icon={Handshake}
            items={context.active}
            emptyLine="Nothing approved yet — approve an opportunity to move it here."
            showDecision={false}
          />
          <Column
            title="Closed"
            icon={CheckCircle2}
            items={context.done}
            emptyLine="Nothing closed yet."
            showDecision={false}
          />
        </>
      )}
    </PageBody>
  )
}
