"use client"

import { DEMO_HEALTH } from "@/lib/careeros/demo-data"
import { CareerOsIcon } from "@/components/careeros/icon"
import { PillarRadarChart } from "@/components/careeros/pillar-radar-chart"
import { RunWorkflowButton } from "@/components/careeros/run-workflow-button"
import { CareerOsBtn, CareerOsPageHeader, CareerOsPill, CareerOsStat } from "@/components/careeros/ui"

export function CareerHealthReportView() {
  const health = DEMO_HEALTH

  return (
    <div className="page-enter">
      <CareerOsPageHeader
        eyebrow={`Career Health Report · ${health.generated}`}
        title="Where you stand this quarter."
        sub={health.narrative_intro}
        actions={
          <RunWorkflowButton
            workflow="careeros/career-health.generate-for-user"
            label="Regenerate report"
            successMessage="Health report queued. Refresh this page in a few minutes."
          />
        }
      />

      <div className="card padded juno-halo" style={{ marginBottom: 28 }}>
        <div className="career-os-split" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
          <PillarRadarChart pillars={health.pillars} overall={health.overall} size={320} />
          <div>
            <CareerOsPill tone="rising">
              <CareerOsIcon name="arrow_up" size={10} /> +{health.delta} vs last quarter
            </CareerOsPill>
            <p className="body" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6 }}>
              Overall score <strong className="mono">{health.overall}</strong> — mid-pivot with strong
              direction and a compounding AI governance skill cluster.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {health.pillars.map((p) => (
          <div key={p.id} className="card padded" id={p.id}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <h2 className="h-section">{p.name}</h2>
              <CareerOsStat label="Score" value={p.score} delta={p.delta} tone="primary" />
            </div>
            <p className="body">{p.blurb}</p>
          </div>
        ))}
      </div>

      <div className="card padded" style={{ marginTop: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Three moves this quarter
        </div>
        <ol className="body" style={{ paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 8 }}>Close the technical-literacy gap on your frontier-lab target shape.</li>
          <li style={{ marginBottom: 8 }}>Publish a client-facing EU AI Act one-pager before the June comment window.</li>
          <li>Book two coffee chats with in-house AI counsel outside your firm.</li>
        </ol>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <CareerOsBtn href="/careeros/skills" sm>
            Skills <CareerOsIcon name="arrow_right" size={12} />
          </CareerOsBtn>
          <CareerOsBtn href="/careeros/market" sm>
            Market <CareerOsIcon name="arrow_right" size={12} />
          </CareerOsBtn>
          <CareerOsBtn href="/careeros/feed" sm>
            Feed <CareerOsIcon name="arrow_right" size={12} />
          </CareerOsBtn>
        </div>
      </div>
    </div>
  )
}
