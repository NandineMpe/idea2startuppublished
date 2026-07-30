/* /career/dashboard — landing after sign-in */

/* Compact version of the Health Report pentagon — sized for the right rail */
function MiniPillarRadial({ pillars, overall, size = 240 }) {
  const cx = size / 2, cy = size / 2;
  const N = pillars.length;
  const startAngle = -Math.PI / 2;
  const outerR = size * 0.36;
  const innerR = size * 0.13;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
      <defs>
        <radialGradient id="miniGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.30" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={outerR + 14} fill="url(#miniGlow)" />
      {[0.5, 0.75, 1].map(f => (
        <circle key={f} cx={cx} cy={cy} r={innerR + (outerR - innerR) * f}
          fill="none" stroke="hsl(var(--border))" strokeDasharray="2 3" strokeWidth="0.7" opacity={0.8} />
      ))}
      {pillars.map((p, i) => {
        const a = startAngle + (i / N) * Math.PI * 2;
        const x1 = cx + Math.cos(a) * innerR;
        const y1 = cy + Math.sin(a) * innerR;
        const x2 = cx + Math.cos(a) * outerR;
        const y2 = cy + Math.sin(a) * outerR;
        const x3 = cx + Math.cos(a) * (innerR + (outerR - innerR) * (p.score / 100));
        const y3 = cy + Math.sin(a) * (innerR + (outerR - innerR) * (p.score / 100));
        const xLabel = cx + Math.cos(a) * (outerR + 16);
        const yLabel = cy + Math.sin(a) * (outerR + 16);
        return (
          <g key={p.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--border))" strokeWidth="0.8" />
            <line x1={x1} y1={y1} x2={x3} y2={y3} stroke="hsl(var(--primary))" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx={x3} cy={y3} r="3" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="1.3" />
            <text x={xLabel} y={yLabel} textAnchor="middle" dominantBaseline="middle"
                  fontSize="9.5" fontWeight="500" fill="hsl(var(--foreground))" letterSpacing="-0.01em">{p.name}</text>
          </g>
        );
      })}
      <polygon
        points={pillars.map((p, i) => {
          const a = startAngle + (i / N) * Math.PI * 2;
          const r = innerR + (outerR - innerR) * (p.score / 100);
          return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
        }).join(" ")}
        fill="hsl(var(--primary) / 0.08)"
        stroke="hsl(var(--primary) / 0.3)"
        strokeWidth="0.8"
      />
      <circle cx={cx} cy={cy} r={innerR - 1} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="600"
            fill="hsl(var(--primary))" letterSpacing="-0.02em">{overall}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="7.5" letterSpacing="0.12em"
            fill="hsl(var(--muted-foreground))">OVERALL</text>
    </svg>
  );
}

function DashboardScreen({ navigate }) {
  const ctx = window.DASH_CTX;
  const topSkills = window.SKILLS
    .slice()
    .sort((a, b) => b.level - a.level)
    .slice(0, 5);

  const modules = [
    { id: "feed",          title: "AI Updates Feed",      icon: "news",     route: "/careeros/feed",          desc: "Personalised AI and market intelligence, filtered to your skills and role.", badge: "12 new" },
    { id: "skills",        title: "Skill Portfolio",       icon: "brain",    route: "/careeros/skills",        desc: "Your skill half-life tracker — rising, stable, declining, at-risk." },
    { id: "market",        title: "Market Intelligence",   icon: "trending", route: "/careeros/market",        desc: "Demand trends, salary bands, and adjacent roles for your function." },
    { id: "health",        title: "Career Health Report",  icon: "heart",    route: "/careeros/health-report", desc: "Quarterly narrative across five pillars, with linked next steps.", badge: "Updated 2d" },
  ];

  return (
    <div className="page-enter">
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 32 }}>
        <div>
          <header style={{ marginBottom: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Career OS · London, UK</div>
            <h1 className="h-display">Welcome back, Eleanor.</h1>
            <p className="body" style={{ marginTop: 10, maxWidth: 560 }}>
              {ctx.profileHeadline}
            </p>
          </header>

          {/* Hero strip: status + Juno's read on today */}
          <div className="card padded sage-halo voice-target" data-voice="hero-status" style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 999,
                background: "hsl(var(--primary))",
                color: "white",
                display: "grid", placeItems: "center",
                flexShrink: 0,
                fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic",
                fontWeight: 600, fontSize: 15,
              }}>J</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span className="eyebrow" style={{ letterSpacing: "0.1em" }}>Juno's read · today</span>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: "hsl(var(--primary))" }} />
                  <span className="micro">Last refresh 2h ago</span>
                </div>
                <p className="body" style={{ fontSize: 14, lineHeight: 1.6, color: "hsl(var(--foreground) / 0.92)", marginBottom: 12 }}>
                  Steady week, and a useful one. <strong>ISO/IEC 42001</strong> ticked up four points — your Lead Implementer progress is being matched by demand signal. The piece worth acting on: <strong>the EU AI Office published a draft delegated act narrowing Article 6(2)</strong>, comment window closes 11 June — your Series B AI infra client's Annex III map may shift. Anthropic also published its first public system-card template for high-risk classification reviews; lift the format into your client playbook. AI Governance Counsel postings in your geo gained <strong>22%</strong> this quarter — the August deadline is doing the work.
                </p>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                  <span className="micro" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Icon name="news" size={11} /> <span className="mono">12</span> new feed items
                  </span>
                  <span className="micro" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Icon name="brain" size={11} /> <span className="mono">2</span> skill movements
                  </span>
                  <span className="micro" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Icon name="compass" size={11} /> <span className="mono">1</span> new adjacent role
                  </span>
                  <span className="micro" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Icon name="alert" size={11} /> <span className="mono">1</span> regulator deadline
                  </span>
                  <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => navigate("/careeros")}>
                    Open workspace <Icon name="arrow_right" size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <SectionHeader title="Your workspace" right={<span className="micro">4 modules</span>} />
          <div style={{ display: "grid", gap: 10, marginBottom: 32 }}>
            {modules.map((mod) => (
              <button key={mod.id} className="row-link" onClick={() => navigate(mod.route)}>
                <div className="icon-tile"><Icon name={mod.icon} size={17} /></div>
                <div className="copy">
                  <div className="title">{mod.title}</div>
                  <div className="sub">{mod.desc}</div>
                </div>
                {mod.badge && <Pill solid>{mod.badge}</Pill>}
                <Icon name="chevron_right" size={16} className="chev" />
              </button>
            ))}
          </div>

          <SectionHeader
            title="Skill snapshot"
            right={<button className="btn ghost sm" onClick={() => navigate("/careeros/skills")}>Full portfolio <Icon name="arrow_right" size={12}/></button>}
          />
          <div className="card voice-target" data-voice="skill-snapshot">
            {topSkills.map((s) => (
              <div className="row" key={s.name}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{s.name}</span>
                    <Pill tone={s.status}>{s.status}</Pill>
                  </div>
                  <Meter value={s.level} tone={s.status} size="sm" />
                </div>
                <div style={{ width: 80, flexShrink: 0, color: `hsl(var(--status-${s.status === "at-risk" ? "risk" : s.status}))` }}>
                  <Sparkline data={s.trend} width={80} height={22} />
                </div>
                <div className="micro" style={{ width: 60, textAlign: "right" }}>HL {s.halflife}mo</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card padded voice-target" data-voice="health-card">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <div className="eyebrow">Career Health · Q2</div>
              <Pill tone="rising">
                <Icon name="arrow_up" size={10} /> +{window.HEALTH.delta} qtr
              </Pill>
            </div>
            <div style={{ display: "grid", placeItems: "center", margin: "6px 0 4px" }}>
              <MiniPillarRadial pillars={window.HEALTH.pillars} overall={window.HEALTH.overall} size={240} />
            </div>
            <div className="body" style={{ fontSize: 12.5, lineHeight: 1.55, color: "hsl(var(--foreground) / 0.85)" }}>
              <strong>Mid-pivot, in the timing window.</strong> Direction (90) is your strongest pillar — three target shapes ranked, portfolio aligns. The AI Governance cluster is doing the lift on Skills (+11). <strong>Network</strong> nudged up after the SCL panel but is still the soft spot.
            </div>
            <hr className="div" style={{ margin: "12px 0" }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
              {window.HEALTH.pillars.map(p => (
                <div key={p.id} style={{ textAlign: "center" }}>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--primary))" }}>{p.score}</div>
                  <div className="micro" style={{ fontSize: 9.5, marginTop: 1 }}>{p.name.split(" ")[0]}</div>
                </div>
              ))}
            </div>
            <button
              className="btn primary sm"
              style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
              onClick={() => navigate("/careeros/health-report")}
            >
              Open full report <Icon name="arrow_right" size={13} />
            </button>
          </div>

          <div className="card padded voice-target" data-voice="target-role">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Target role</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{window.MARKET.role_title}</div>
            <div className="small" style={{ marginTop: 4 }}>From {window.PROFILE.current_role_title}</div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Stat label="Demand index" value={window.MARKET.demand_index} delta={window.MARKET.demand_change_90d} sub="vs 90d ago" tone="primary" />
              <Stat label="Salary p50" value={`£${(window.MARKET.salary.p50/1000)|0}k`} sub="London median" />
            </div>
            <button className="btn sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={() => navigate("/careeros/market")}>
              Market intel <Icon name="arrow_right" size={13} />
            </button>
          </div>

          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Pinned</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {window.FEED[0].items.slice(0, 2).map((it) => (
                <div key={it.title}>
                  <div className="micro" style={{ marginBottom: 3 }}>{it.source} · {it.kind} · {it.time}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.4, fontWeight: 500 }}>{it.title}</div>
                </div>
              ))}
            </div>
            <button className="btn ghost sm" style={{ marginTop: 10, padding: 0 }} onClick={() => navigate("/careeros/feed")}>
              Open feed <Icon name="arrow_right" size={12} />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.DashboardScreen = DashboardScreen;
