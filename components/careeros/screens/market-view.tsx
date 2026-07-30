"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import type { MarketIntelligencePayload } from "@/lib/careeros/market/load-market-intelligence"
import { formatUsd } from "@/lib/careeros/market/load-market-intelligence"
import { CareerOsIcon } from "@/components/careeros/icon"
import {
  CareerOsBtn,
  CareerOsPageHeader,
  CareerOsPill,
  CareerOsSectionHeader,
  CareerOsStat,
} from "@/components/careeros/ui"
import { toast } from "sonner"

function DemandChart({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <p className="body micro" style={{ marginTop: 8 }}>
        Demand windows not cached yet. Queue a market refresh, then reload.
      </p>
    )
  }
  const w = 100
  const h = 30
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / span) * h
    return [x, y] as const
  })
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ")
  const area = `${path} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h + 4}`} width="100%" height={120} preserveAspectRatio="none">
      <path d={area} fill="hsl(var(--primary))" fillOpacity="0.1" />
      <path
        d={path}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function EvidenceLine({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p className="micro" style={{ marginTop: 8, opacity: 0.75 }}>
      {text}
    </p>
  )
}

export function CareerMarketView({
  initial,
  signedIn,
}: {
  initial: MarketIntelligencePayload | null
  signedIn: boolean
}) {
  const router = useRouter()
  const [data, setData] = useState<MarketIntelligencePayload | null>(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [reloading, setReloading] = useState(false)

  const reloadLive = useCallback(async () => {
    setReloading(true)
    try {
      const res = await fetch("/api/careeros/market/intelligence", {
        credentials: "include",
        cache: "no-store",
      })
      const json = (await res.json()) as MarketIntelligencePayload & { error?: string }
      if (!res.ok) throw new Error(json.error || "Could not load market data")
      setData(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reload market data")
    } finally {
      setReloading(false)
    }
  }, [])

  async function queueRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/careeros/market/refresh", {
        method: "POST",
        credentials: "include",
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) throw new Error(body.error || "Could not queue refresh")
      toast.success(body.message ?? "Market refresh queued.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not queue refresh")
    } finally {
      setRefreshing(false)
    }
  }

  if (!signedIn) {
    return (
      <div className="page-enter">
        <CareerOsPageHeader
          eyebrow="Market intelligence"
          title="Sign in to see live market data."
          sub="Adjacent roles, demand, salary bands, and job listings are tied to your profile and region."
        />
        <CareerOsBtn href="/login">Sign in</CareerOsBtn>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page-enter">
        <CareerOsPageHeader eyebrow="Market intelligence" title="Loading market data…" />
      </div>
    )
  }

  const cur = data.currency_symbol
  const targetLabel = data.target_role_title ?? "your target role"
  const cacheMiss = data.cache_misses.length > 0
  const showEmpty = data.status === "empty" || (data.adjacent_status === "cache_miss" && !data.demand_index)

  return (
    <div className="page-enter">
      <CareerOsPageHeader
        eyebrow="Market intelligence"
        title={`Demand for ${targetLabel}`}
        sub={
          data.region_label
            ? `Region: ${data.region_label}. Stats use your CareerOS cache and live queries from configured vendors only.`
            : "Set your region in profile settings for geo-scoped salary and demand."
        }
        actions={
          <>
            <CareerOsBtn ghost sm onClick={() => void reloadLive()} disabled={reloading}>
              <CareerOsIcon name={reloading ? "clock" : "trending"} size={14} />
              {reloading ? "Reloading…" : "Reload live"}
            </CareerOsBtn>
            <CareerOsBtn
              onClick={() => void queueRefresh()}
              disabled={refreshing || !data.can_refresh_cache}
            >
              <CareerOsIcon name="sparkles" size={14} />
              {refreshing ? "Queuing…" : "Refresh cache"}
            </CareerOsBtn>
          </>
        }
      />

      {data.status === "profile_incomplete" ? (
        <div className="card padded" style={{ marginBottom: 18 }}>
          <p className="body">{data.profile_incomplete_reason}</p>
          {data.needs_onet_map && data.can_refresh_cache ? (
            <CareerOsBtn onClick={() => void queueRefresh()} sm style={{ marginTop: 12 }} disabled={refreshing}>
              {refreshing ? "Queuing…" : "Map O*NET role"}
            </CareerOsBtn>
          ) : (
            <CareerOsBtn href="/careeros/onboarding" sm style={{ marginTop: 12 }}>
              Complete profile
            </CareerOsBtn>
          )}
        </div>
      ) : null}

      {cacheMiss ? (
        <div className="card padded" style={{ marginBottom: 18, borderColor: "hsl(var(--border))" }}>
          <p className="body">
            Missing cache: {data.cache_misses.join(", ")}.
            {data.can_refresh_cache ? (
              <>
                {" "}
                Hit <strong>Refresh cache</strong>, wait a few minutes, then <strong>Reload live</strong>.
              </>
            ) : (
              " Market refresh is not available until O*NET and Inngest are configured on the server."
            )}
          </p>
        </div>
      ) : null}

      {showEmpty && data.status !== "profile_incomplete" ? (
        <div className="card padded" style={{ marginBottom: 18 }}>
          <p className="body">No market rows yet for your SOC and region. Queue refresh, then reload.</p>
        </div>
      ) : null}

      <div className="career-os-stat-grid" style={{ marginBottom: 22 }}>
        <div className="card padded">
          <CareerOsStat
            label="Demand index"
            value={data.demand_index != null ? String(Math.round(data.demand_index)) : "—"}
            delta={data.demand_delta_90d ?? undefined}
            tone="primary"
          />
          <EvidenceLine text={data.demand_evidence} />
        </div>
        {data.live_postings_vendor ? (
          <div className="card padded">
            <CareerOsStat
              label="Open postings"
              value={data.postings_count != null ? String(data.postings_count) : "—"}
              sub={
                data.live_postings_vendor === "adzuna"
                  ? "Adzuna · your region"
                  : data.live_postings_vendor === "jsearch"
                    ? "JSearch · your region"
                    : "TheirStack · last 30d"
              }
            />
            <EvidenceLine text={data.postings_evidence} />
          </div>
        ) : null}
        <div className="card padded">
          <CareerOsStat
            label="Salary p50"
            value={formatUsd(cur, data.salary_p50)}
            sub="mid band · cached vendors"
          />
          <EvidenceLine text={data.salary_evidence} />
        </div>
        <div className="card padded">
          <CareerOsStat
            label="Your comp"
            value={formatUsd(cur, data.current_salary_mid)}
            sub="profile or mid band"
          />
        </div>
      </div>

      <div className="career-os-two-col">
        <div className="card padded">
          <CareerOsSectionHeader
            title="Demand windows"
            sub="M720 → M30 from market_demand_trajectories (not invented)"
          />
          <DemandChart data={data.demand_series} />
          <p className="body" style={{ marginTop: 12 }}>
            {data.current_role_title ? (
              <>
                From <strong>{data.current_role_title}</strong>
              </>
            ) : null}
            {data.target_role_title ? (
              <>
                {" "}
                toward <strong>{data.target_role_title}</strong>
              </>
            ) : null}
            {data.source_soc_code ? (
              <span className="micro"> · O*NET {data.source_soc_code}</span>
            ) : null}
          </p>
        </div>

        <div className="card padded">
          <CareerOsSectionHeader title="Active data sources" sub="Only vendors wired in this deployment" />
          <ul className="body" style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {data.data_sources.map((src) => (
              <li key={src.id}>
                <strong>{src.label}</strong>
                <span className="micro"> · {src.used_for}</span>
              </li>
            ))}
          </ul>
          {!data.job_listings_live ? (
            <p className="micro" style={{ marginTop: 12 }}>
              Per-role employer links are hidden until TheirStack is configured. Demand and salary still use
              Adzuna and JSearch when those keys are set.
            </p>
          ) : null}
        </div>
      </div>

      <CareerOsSectionHeader
        title="Adjacent roles"
        sub={
          data.job_listings_live
            ? "Ranked from cache; employers from live TheirStack search per role"
            : "Ranked from cached demand + salary similarity (O*NET adjacent roles)"
        }
      />

      {data.adjacent_status === "cache_miss" ? (
        <div className="card padded" style={{ marginBottom: 12 }}>
          <p className="body">
            Adjacent role cache is empty for O*NET {data.source_soc_code}. Refresh cache, then reload.
          </p>
        </div>
      ) : null}

      {data.adjacent_roles.length === 0 && data.adjacent_status === "ready" ? (
        <p className="body">No adjacent rows returned.</p>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {data.adjacent_roles.map((adj) => (
          <div key={adj.target_soc_code} className="card padded">
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{adj.target_title}</div>
                <p className="micro" style={{ marginTop: 4 }}>
                  {adj.evidence_similarity}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {adj.bridge_skills.map((b) => (
                    <CareerOsPill key={b}>{b}</CareerOsPill>
                  ))}
                </div>

                {data.job_listings_live && adj.listings.length > 0 ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="micro" style={{ fontWeight: 600, marginBottom: 8 }}>
                      Hiring now
                      {adj.listings_total != null ? ` · ${adj.listings_total} total (TheirStack)` : ""}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {adj.listings.map((job) => (
                        <a
                          key={job.url}
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 13,
                            textDecoration: "none",
                            color: "inherit",
                            borderBottom: "1px solid hsl(var(--border))",
                            paddingBottom: 6,
                          }}
                        >
                          <strong>{job.company_name}</strong>
                          <span className="micro"> · {job.title}</span>
                          {job.location_label ? (
                            <span className="micro"> · {job.location_label}</span>
                          ) : null}
                        </a>
                      ))}
                    </div>
                    <EvidenceLine text={adj.evidence_listings} />
                  </div>
                ) : data.job_listings_live ? (
                  <p className="body" style={{ marginTop: 12 }}>
                    No live listings returned. {adj.evidence_listings}
                  </p>
                ) : null}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <CareerOsPill solid>{adj.fit_pct}% fit</CareerOsPill>
                <div className="micro" style={{ marginTop: 6 }}>
                  {adj.bridge_skill_count} bridge skills
                  {adj.salary_mid_delta_usd != null
                    ? ` · ${adj.salary_mid_delta_usd >= 0 ? "+" : ""}${formatUsd(cur, Math.abs(adj.salary_mid_delta_usd))} mid`
                    : ""}
                  {adj.demand_delta_pct_points != null
                    ? ` · demand ${adj.demand_delta_pct_points >= 0 ? "+" : ""}${adj.demand_delta_pct_points}pp`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <CareerOsBtn href="/careeros/skills" ghost sm>
          See skills portfolio <CareerOsIcon name="arrow_right" size={12} />
        </CareerOsBtn>
      </div>
    </div>
  )
}
