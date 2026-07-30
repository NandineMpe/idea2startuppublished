/* /careeros/market — Demand, salary bands, adjacent roles for target role */

function DemandChart({ data, accentColor }) {
  const w = 100, h = 30;
  const min = Math.min(...data), max = Math.max(...data);
  const span = (max - min) || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return [x, y];
  });
  const path = pts.map(([x,y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h+4}`} width="100%" height="160" preserveAspectRatio="none">
      <path d={area} fill={accentColor || "hsl(var(--primary))"} fillOpacity="0.1" />
      <path d={path} fill="none" stroke={accentColor || "hsl(var(--primary))"} strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SalaryBands({ market }) {
  const { p25, p50, p75, p90 } = market.salary;
  const ub = market.salary.user_band;
  const cur = market.currency || "£";
  const min = Math.min(ub.p25, p25) * 0.92;
  const max = p90 * 1.04;
  const span = max - min;
  const xOf = (v) => ((v - min) / span) * 100;
  return (
    <div style={{ padding: "8px 4px 0" }}>
      <div className="micro" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between" }}>
        <span>{cur}{(min/1000)|0}k</span>
        <span>{cur}{(max/1000)|0}k</span>
      </div>

      {/* User band */}
      <div style={{ position: "relative", height: 36, marginBottom: 18 }}>
        <div className="micro" style={{ position: "absolute", top: -16, left: 0 }}>You · current band</div>
        <div style={{
          position: "absolute", height: 8, top: 14,
          left: `${xOf(ub.p25)}%`, width: `${xOf(ub.p75) - xOf(ub.p25)}%`,
          background: "hsl(var(--muted-foreground) / 0.25)",
          borderRadius: 999,
        }} />
        <div title={`Your p50 · ${cur}${(ub.p50/1000)|0}k`} style={{
          position: "absolute", top: 8, left: `calc(${xOf(ub.p50)}% - 7px)`,
          width: 14, height: 14, borderRadius: 999,
          background: "hsl(var(--card))",
          border: "2px solid hsl(var(--foreground))",
        }} />
        <div className="mono micro" style={{ position: "absolute", top: 26, left: `calc(${xOf(ub.p50)}% - 22px)`, width: 44, textAlign: "center" }}>
          {cur}{(ub.p50/1000)|0}k
        </div>
      </div>

      {/* Target role band */}
      <div style={{ position: "relative", height: 50 }}>
        <div className="micro" style={{ position: "absolute", top: -16, left: 0 }}>{market.role_title} · market band</div>
        <div style={{
          position: "absolute", height: 10, top: 14,
          left: `${xOf(p25)}%`, width: `${xOf(p90) - xOf(p25)}%`,
          background: "hsl(var(--primary) / 0.18)",
          borderRadius: 999,
        }} />
        <div style={{
          position: "absolute", height: 10, top: 14,
          left: `${xOf(p25)}%`, width: `${xOf(p75) - xOf(p25)}%`,
          background: "hsl(var(--primary) / 0.42)",
          borderRadius: 999,
        }} />
        {/* Markers */}
        {[
          { v: p25, label: "p25" },
          { v: p50, label: "p50" },
          { v: p75, label: "p75" },
          { v: p90, label: "p90" },
        ].map(m => (
          <React.Fragment key={m.label}>
            <div style={{
              position: "absolute", top: 11, left: `${xOf(m.v)}%`,
              width: 1, height: 16,
              background: m.label === "p50" ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)",
            }} />
            <div className="mono micro" style={{ position: "absolute", top: 30, left: `calc(${xOf(m.v)}% - 22px)`, width: 44, textAlign: "center", color: m.label === "p50" ? "hsl(var(--primary))" : undefined }}>
              {cur}{(m.v/1000)|0}k
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MarketScreen({ navigate }) {
  const m = window.MARKET;
  const cur = m.currency || "£";

  const months = ["F","M","A","M","J","J","A","S","O","N","D","J"];

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={`Market intelligence · ${m.deadline_note} · Refreshed 4h ago`}
        title={`${m.role_title}`}
        sub={`Live market signal for your target role. Pulled from Adzuna, Reed, Totaljobs, LinkedIn Hiring, and curated tracking of UK in-house and frontier-lab careers pages daily; salary bands triangulated from posting text where stated and from public Glassdoor + Levels.fyi comparables.`}
        actions={
          <>
            <button className="btn"><Icon name="filter" size={14} /> Filter geos</button>
            <button className="btn primary"><Icon name="bookmark" size={14} /> Save snapshot</button>
          </>
        }
      />

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <div className="card padded">
          <Stat label="Demand index" value={m.demand_index} delta={m.demand_change_90d} sub="vs 90 days ago" tone="primary" />
        </div>
        <div className="card padded">
          <Stat label="Open postings (UK/EU)" value={m.postings_now.toLocaleString()} delta={Math.round(((m.postings_now-m.postings_quarter_ago)/m.postings_quarter_ago)*100)} sub="vs last quarter" />
        </div>
        <div className="card padded">
          <Stat label="Salary p50" value={`${cur}${(m.salary.p50/1000)|0}k`} sub={`p25–p75: ${cur}${(m.salary.p25/1000)|0}–${(m.salary.p75/1000)|0}k`} />
        </div>
        <div className="card padded">
          <Stat label="Your fit (top role)" value="84%" delta={9} sub="bridge skills mapped" tone="primary" />
        </div>
      </div>

      {/* Demand chart + geo */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 22, marginBottom: 22 }}>
        <div className="card padded">
          <SectionHeader
            title="Demand trend"
            sub="12-month rolling index, base = 100 at month 0"
            right={
              <div className="tabs">
                <button className="tab active">12m</button>
                <button className="tab">YTD</button>
                <button className="tab">All</button>
              </div>
            }
          />
          <DemandChart data={m.demand_series} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            {months.map((mo, i) => (
              <span key={i} className="micro" style={{ fontSize: 10 }}>{mo}</span>
            ))}
          </div>
          <hr className="div" style={{ margin: "16px 0" }} />
          <div className="body">
            <strong>Reading: </strong>
            Demand for AI Governance Counsel has climbed every month this year, with the steepest gains in the last 90 days as the 2 August high-risk obligations enter the budget cycle. Hiring divides cleanly between three buyers: frontier labs (small in number, high pay, technical-literacy gate), UK public sector (DSIT, AISI, ICO — lower pay, policy-shaping work), and AI-deploying enterprises in financial services and healthcare (stable, well-paid, governance-as-compliance shape).
          </div>
        </div>

        <div className="card padded">
          <SectionHeader title="Geographic distribution" sub={`${m.postings_now.toLocaleString()} open postings`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
            {(() => {
              const maxShare = Math.max(...m.geo.map(g => g.share));
              return m.geo.map(g => (
                <div key={g.city}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{g.city}</span>
                    <span className="micro mono">{g.count} · {cur}{(g.p50/1000)|0}k</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: "hsl(var(--surface-2))", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(g.share/maxShare)*100}%`, background: "hsl(var(--primary))", borderRadius: 999 }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* Salary bands */}
      <div className="card padded" style={{ marginBottom: 22 }}>
        <SectionHeader
          title="Salary bands"
          sub="Your current 3 PQE band vs the AI Governance Counsel market band — base, GBP, London-weighted"
          right={<span className="micro">From 312 UK/EU postings · 54% disclose comp</span>}
        />
        <SalaryBands market={m} />
      </div>

      {/* Adjacent roles */}
      <SectionHeader
        title="Adjacent roles"
        sub="Role shapes within 2–4 bridge skills of your portfolio, ranked by fit. Reflects your declared preference order: in-house frontier-lab → UK public sector → specialist advisory."
        right={<button className="btn ghost sm">See all 9 <Icon name="arrow_right" size={12} /></button>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {m.adjacent.map((r, i) => (
          <div key={r.role} className={`card padded voice-target`} data-voice={`adjacent-${i}`}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{r.role}</div>
                  {i === 0 && <Pill solid>Top match</Pill>}
                </div>
                <div className="small" style={{ marginTop: 4 }}>{r.gap}-skill bridge · {r.lift} salary lift</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "hsl(var(--primary))" }}>{Math.round(r.fit*100)}%</div>
                <div className="micro">fit</div>
              </div>
            </div>
            <div className="body" style={{ fontSize: 12.5, marginBottom: 12 }}>{r.notes}</div>
            <div className="micro" style={{ marginBottom: 6 }}>Bridge skills you'd build</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {r.bridge.map(b => <Pill key={b}>{b}</Pill>)}
            </div>
            <hr className="div" style={{ margin: "14px 0" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm" style={{ flex: 1, justifyContent: "center" }}>Plan jump</button>
              <button className="btn ghost sm">Compare <Icon name="arrow_right" size={11} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.MarketScreen = MarketScreen;
