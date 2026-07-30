"use client"

import { useMemo, useState } from "react"
import { DEMO_SKILLS, type DemoSkill } from "@/lib/careeros/demo-data"
import { CareerOsIcon } from "@/components/careeros/icon"
import {
  CareerOsBtn,
  CareerOsMeter,
  CareerOsPageHeader,
  CareerOsPill,
  CareerOsSparkline,
  CareerOsStat,
} from "@/components/careeros/ui"

export type PortfolioSkillRow = {
  id: string
  name: string
  status: string | null
  level: number
  halflife: number | null
  exposure: number | null
  trend: number[]
  cluster: string
  source: string
}

function mapDemoToRow(s: DemoSkill, i: number): PortfolioSkillRow {
  return {
    id: `demo-${i}`,
    name: s.name,
    status: s.status,
    level: s.level,
    halflife: s.halflife,
    exposure: s.exposure,
    trend: s.trend,
    cluster: s.cluster,
    source: s.source,
  }
}

export function SkillsPortfolioView({
  skills,
  useDemoFallback,
}: {
  skills: PortfolioSkillRow[]
  useDemoFallback?: boolean
}) {
  const list = useMemo(() => {
    if (skills.length > 0) return skills
    if (useDemoFallback) return DEMO_SKILLS.map(mapDemoToRow)
    return []
  }, [skills, useDemoFallback])

  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState("status")

  const filtered = useMemo(() => {
    let rows = [...list]
    if (filter !== "all") rows = rows.filter((s) => s.status === filter)
    if (sort === "halflife") rows.sort((a, b) => (a.halflife ?? 99) - (b.halflife ?? 99))
    else if (sort === "exposure") rows.sort((a, b) => (b.exposure ?? 0) - (a.exposure ?? 0))
    else if (sort === "level") rows.sort((a, b) => b.level - a.level)
    else {
      const order: Record<string, number> = { rising: 0, "at-risk": 1, declining: 2, stable: 3 }
      rows.sort((a, b) => (order[a.status ?? ""] ?? 9) - (order[b.status ?? ""] ?? 9))
    }
    return rows
  }, [list, filter, sort])

  const counts = list.reduce(
    (acc, s) => {
      acc.all++
      const st = s.status ?? "stable"
      if (st in acc) acc[st as keyof typeof acc]++
      return acc
    },
    { all: 0, rising: 0, stable: 0, declining: 0, "at-risk": 0 } as Record<string, number>,
  )

  return (
    <div className="page-enter">
      <CareerOsPageHeader
        eyebrow="Skill portfolio"
        title="Your skills, and how long they'll last."
        sub="Half-life estimates how long each skill stays load-bearing in market postings. AI exposure is the share of role-tasks an LLM can now do unsupervised."
        actions={
          <>
            <CareerOsBtn>
              <CareerOsIcon name="download" size={14} /> Export CSV
            </CareerOsBtn>
            <CareerOsBtn primary>
              <CareerOsIcon name="sparkles" size={14} /> Suggest a learning plan
            </CareerOsBtn>
          </>
        }
      />

      {list.length === 0 && (
        <div className="card padded">
          <p className="body">No skills yet. Complete onboarding to populate your portfolio.</p>
          <CareerOsBtn href="/careeros/onboarding" primary sm className="!mt-3">
            Complete profile
          </CareerOsBtn>
        </div>
      )}

      {list.length > 0 && (
        <>
          <div className="career-os-stat-grid" style={{ marginBottom: 22 }}>
            <div className="card padded">
              <CareerOsStat label="Skills tracked" value={list.length} sub="auto + manual" />
            </div>
            <div className="card padded">
              <CareerOsStat label="Avg half-life" value="31 mo" delta={4} sub="vs role median (demo)" />
            </div>
            <div className="card padded">
              <CareerOsStat label="Rising skills" value={counts.rising} tone="primary" sub={`of ${list.length}`} />
            </div>
            <div className="card padded">
              <CareerOsStat label="At-risk" value={counts["at-risk"]} sub="needs attention" />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div className="tabs">
              {[
                { id: "all", label: `All · ${counts.all}` },
                { id: "rising", label: `Rising · ${counts.rising}` },
                { id: "stable", label: `Stable · ${counts.stable}` },
                { id: "declining", label: `Declining · ${counts.declining}` },
                { id: "at-risk", label: `At-risk · ${counts["at-risk"]}` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab ${filter === t.id ? "active" : ""}`}
                  onClick={() => setFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="micro">Sort by</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                  fontSize: 12.5,
                }}
              >
                <option value="status">Status</option>
                <option value="halflife">Half-life</option>
                <option value="exposure">AI exposure</option>
                <option value="level">Level</option>
              </select>
            </div>
          </div>

          <div className="card">
            {filtered.map((s) => (
              <div className="row" key={s.id}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</span>
                    <CareerOsPill tone={s.status ?? undefined}>{s.status ?? "—"}</CareerOsPill>
                    <span className="micro">{s.cluster}</span>
                  </div>
                  <CareerOsMeter value={s.level} tone={s.status ?? "primary"} size="sm" />
                </div>
                <div style={{ width: 88, flexShrink: 0, color: `hsl(var(--status-${s.status === "at-risk" ? "risk" : s.status ?? "stable"}))` }}>
                  <CareerOsSparkline data={s.trend} width={88} />
                </div>
                <div className="micro" style={{ width: 72, textAlign: "right" }}>
                  {s.halflife != null ? `HL ${s.halflife}mo` : "—"}
                </div>
                <div className="micro" style={{ width: 56, textAlign: "right" }}>
                  {s.exposure != null ? `${s.exposure}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
