"use client"

import { useState } from "react"
import { DEMO_FEED } from "@/lib/careeros/demo-data"
import { CareerOsIcon } from "@/components/careeros/icon"
import { RunWorkflowButton } from "@/components/careeros/run-workflow-button"
import { CareerOsBtn, CareerOsPageHeader, CareerOsPill } from "@/components/careeros/ui"

function RelevanceRing({ value = 0, size = 40 }: { value?: number; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  const offset = c * (1 - value)
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        className="mono"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 9.5,
          fontWeight: 600,
          color: "hsl(var(--primary))",
        }}
      >
        {Math.round(value * 100)}
      </div>
    </div>
  )
}

export function CareerFeedView({ liveItemCount }: { liveItemCount?: number }) {
  const feed = DEMO_FEED
  const [openCluster, setOpenCluster] = useState<string | null>(feed[0]?.cluster ?? null)
  const totalItems = feed.reduce((acc, c) => acc + c.items.length, 0)

  return (
    <div className="page-enter">
      <CareerOsPageHeader
        eyebrow="AI Updates feed"
        title="What moved your skills today."
        sub="Items are clustered by which of your skills they affect. Relevance combines portfolio weight, target-role distance, and recency."
        actions={
          <>
            <RunWorkflowButton
              workflow="careeros/feed.personalise-pending-for-user"
              label="Refresh my feed"
              sm
            />
            <CareerOsBtn>
              <CareerOsIcon name="filter" size={14} /> All sources
            </CareerOsBtn>
          </>
        }
      />

      {typeof liveItemCount === "number" && liveItemCount > 0 && (
        <p className="small" style={{ marginBottom: 16 }}>
          {liveItemCount} personalised item{liveItemCount === 1 ? "" : "s"} in your database this month. Demo
          clusters below show the full prototype layout.
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <div className="tabs">
          <button type="button" className="tab active">
            By skill
          </button>
          <button type="button" className="tab">
            By recency
          </button>
          <button type="button" className="tab">
            Bookmarked
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="small">Showing</span>
          <CareerOsPill solid>{totalItems} items</CareerOsPill>
          <CareerOsPill solid>{feed.length} clusters</CareerOsPill>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {feed.map((cluster) => {
          const isOpen = openCluster === cluster.cluster
          return (
            <div key={cluster.cluster} className="card" style={{ overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setOpenCluster(isOpen ? null : cluster.cluster)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 22px",
                  textAlign: "left",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <RelevanceRing value={cluster.relevance} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{cluster.cluster}</div>
                    <CareerOsPill>
                      {cluster.items.length} item{cluster.items.length === 1 ? "" : "s"}
                    </CareerOsPill>
                  </div>
                  <div className="small">{cluster.why}</div>
                </div>
                <CareerOsIcon name={isOpen ? "chevron_down" : "chevron_right"} size={18} />
              </button>
              {isOpen &&
                cluster.items.map((it) => (
                  <div className="card-section" key={it.title}>
                    <div className="micro" style={{ marginBottom: 6 }}>
                      {it.source} · {it.kind} · {it.time} · {it.read_mins} min read
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>
                      {it.title}
                    </div>
                    <p className="body" style={{ fontSize: 13 }}>
                      <span style={{ fontStyle: "italic", color: "hsl(var(--primary))" }}>Juno take: </span>
                      {it.take}
                    </p>
                  </div>
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
