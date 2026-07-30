/* /careeros/skills — Skill portfolio: half-life, AI exposure, status */

function SkillsScreen({ navigate }) {
  const [filter, setFilter] = React.useState("all");
  const [sort, setSort] = React.useState("status");

  const filtered = React.useMemo(() => {
    let list = window.SKILLS.slice();
    if (filter !== "all") list = list.filter(s => s.status === filter);
    if (sort === "halflife") list.sort((a,b) => a.halflife - b.halflife);
    else if (sort === "exposure") list.sort((a,b) => b.exposure - a.exposure);
    else if (sort === "level") list.sort((a,b) => b.level - a.level);
    else { // status priority
      const order = { rising: 0, "at-risk": 1, declining: 2, stable: 3 };
      list.sort((a,b) => (order[a.status]||9) - (order[b.status]||9));
    }
    return list;
  }, [filter, sort]);

  const counts = window.SKILLS.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    acc.all++;
    return acc;
  }, { all: 0, rising: 0, stable: 0, declining: 0, "at-risk": 0 });

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Skill portfolio · Module 3.2"
        title="Your skills, and how long they'll last."
        sub="Half-life estimates how long each skill stays load-bearing in market postings, based on demand decay and AI-substitution signals. AI exposure is the share of role-tasks an LLM can now do unsupervised."
        actions={
          <>
            <button className="btn"><Icon name="download" size={14} /> Export CSV</button>
            <button className="btn primary"><Icon name="sparkles" size={14} /> Suggest a learning plan</button>
          </>
        }
      />

      {/* Top-line metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 22 }}>
        <div className="card padded">
          <Stat label="Skills tracked" value={window.SKILLS.length} sub="auto + manual" />
        </div>
        <div className="card padded">
          <Stat label="Avg half-life" value="31 mo" delta={4} sub="vs your role's median" />
        </div>
        <div className="card padded">
          <Stat label="Avg AI exposure" value="32%" delta={-3} sub="lower is better" />
        </div>
        <div className="card padded">
          <Stat label="Rising skills" value={counts.rising} tone="primary" sub={`of ${window.SKILLS.length}`} />
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div className="tabs">
          {[
            { id: "all", label: `All · ${counts.all}` },
            { id: "rising", label: `Rising · ${counts.rising}` },
            { id: "stable", label: `Stable · ${counts.stable}` },
            { id: "declining", label: `Declining · ${counts.declining}` },
            { id: "at-risk", label: `At-risk · ${counts["at-risk"]}` },
          ].map(t => (
            <button key={t.id} className={`tab ${filter === t.id ? "active" : ""}`} onClick={() => setFilter(t.id)}>
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
              color: "hsl(var(--foreground))",
              fontSize: 12.5,
              fontFamily: "inherit",
            }}
          >
            <option value="status">Status priority</option>
            <option value="halflife">Half-life (shortest first)</option>
            <option value="exposure">AI exposure (highest first)</option>
            <option value="level">Mastery level</option>
          </select>
        </div>
      </div>

      {/* Skill rows */}
      <div className="card">
        <div className="row" style={{ background: "hsl(var(--surface-1))", borderTopLeftRadius: "calc(var(--radius) - 1px)", borderTopRightRadius: "calc(var(--radius) - 1px)" }}>
          <div className="micro" style={{ flex: 2, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Skill</div>
          <div className="micro" style={{ width: 120, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Status</div>
          <div className="micro" style={{ width: 110, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>90-day trend</div>
          <div className="micro" style={{ width: 90, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>Half-life</div>
          <div className="micro" style={{ width: 120, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>AI exposure</div>
          <div className="micro" style={{ width: 80, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "right" }}>Salary lift</div>
        </div>
        {filtered.map(s => {
          const toneVarName = s.status === "at-risk" ? "risk" : s.status;
          return (
            <div className="row voice-target" data-voice={`skill-${s.name.replace(/[^a-z0-9]/gi,'-').toLowerCase()}`} key={s.name}>
              <div style={{ flex: 2, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.name}</div>
                <div className="micro" style={{ marginTop: 2 }}>{s.cluster} · {s.source}</div>
              </div>
              <div style={{ width: 120 }}><Pill tone={s.status}>{s.status}</Pill></div>
              <div style={{ width: 110, color: `hsl(var(--status-${toneVarName}))` }}>
                <Sparkline data={s.trend} width={90} height={26} area />
              </div>
              <div style={{ width: 90, textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 13, fontWeight: 500 }}>{s.halflife}<span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 400 }}> mo</span></div>
              </div>
              <div style={{ width: 120 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Meter value={s.exposure} tone={s.exposure > 50 ? "at-risk" : s.exposure > 30 ? "declining" : "rising"} size="sm" />
                  </div>
                  <span className="mono" style={{ fontSize: 11, width: 28, textAlign: "right" }}>{s.exposure}%</span>
                </div>
              </div>
              <div style={{ width: 80, textAlign: "right" }}>
                <span className="mono" style={{ fontSize: 12.5, color: s.salary_lift.startsWith("+") && s.salary_lift !== "+0%" ? "hsl(var(--status-rising))" : "hsl(var(--muted-foreground))" }}>{s.salary_lift}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom insight */}
      <div className="card padded sage-halo voice-target" data-voice="coach-summary" style={{ marginTop: 22 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div className="icon-tile" style={{ width: 36, height: 36 }}><Icon name="sparkles" size={17} /></div>
          <div style={{ flex: 1 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Coach summary</div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Your AI Governance cluster is growing faster than the rest of the portfolio combined.</div>
            <div className="body">
              The two skills moving fastest — <strong>EU AI Act</strong> and <strong>AI Risk Classification</strong> — track exactly the work the August 2026 high-risk obligations will demand from your target employers. <strong>ISO/IEC 42001</strong> is next; finish the Lead Implementer and it crosses the threshold where in-house teams will treat it as a marketable credential.
              The decay-side is cleaner than for most: <strong>Subject Access Requests</strong> (18-month half-life, 64% exposure) and <strong>Trade Mark Prosecution residue</strong> are sunsetting. Both are fine to let go — SARs are being de-leveled by tooling, and Trade Mark was always a residue of your IP trainee seat rather than something you market.
              The risk to actively manage: your private-practice DNA still skews to drafting and advisory. Frontier-lab in-house roles want engineering-adjacent, policy-shaped work. The fast.ai progress and ISO 42001 are doing that job; protect the time.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="btn primary sm" onClick={() => navigate("/careeros/health-report")}>
                See in Health Report <Icon name="arrow_right" size={12} />
              </button>
              <button className="btn sm">Open learning plan</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.SkillsScreen = SkillsScreen;
