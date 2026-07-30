/* /careeros/health-report — hybrid: hero pillar viz + scrollable narrative */

function PillarRadial({ pillars, overall }) {
  // Draw 5 radial pillars in a pentagon arrangement.
  const size = 320;
  const cx = size / 2, cy = size / 2;
  const N = pillars.length;
  const startAngle = -Math.PI / 2;
  const outerR = 130;
  const innerR = 42;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* halo */}
      <circle cx={cx} cy={cy} r={outerR + 16} fill="url(#centerGlow)" />

      {/* grid rings */}
      {[0.4, 0.6, 0.8, 1].map(f => (
        <circle key={f} cx={cx} cy={cy} r={innerR + (outerR - innerR) * f}
          fill="none" stroke="hsl(var(--border))" strokeDasharray="2 4" strokeWidth="0.8" opacity={0.8} />
      ))}

      {/* spokes + bars */}
      {pillars.map((p, i) => {
        const a = startAngle + (i / N) * Math.PI * 2;
        const x1 = cx + Math.cos(a) * innerR;
        const y1 = cy + Math.sin(a) * innerR;
        const x2 = cx + Math.cos(a) * outerR;
        const y2 = cy + Math.sin(a) * outerR;
        const x3 = cx + Math.cos(a) * (innerR + (outerR - innerR) * (p.score / 100));
        const y3 = cy + Math.sin(a) * (innerR + (outerR - innerR) * (p.score / 100));
        const xLabel = cx + Math.cos(a) * (outerR + 22);
        const yLabel = cy + Math.sin(a) * (outerR + 22);
        const xScore = cx + Math.cos(a) * (outerR + 6);
        const yScore = cy + Math.sin(a) * (outerR + 6);
        return (
          <g key={p.id}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="hsl(var(--border))" strokeWidth="1" />
            <line x1={x1} y1={y1} x2={x3} y2={y3}
                  stroke="hsl(var(--primary))" strokeWidth="6"
                  strokeLinecap="round" />
            <circle cx={x3} cy={y3} r="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="1.5" />
            <text x={xLabel} y={yLabel} textAnchor="middle" dominantBaseline="middle"
                  fontSize="11" fontWeight="500" fill="hsl(var(--foreground))">{p.name}</text>
          </g>
        );
      })}

      {/* polygon overlay connecting current scores */}
      <polygon
        points={pillars.map((p, i) => {
          const a = startAngle + (i / N) * Math.PI * 2;
          const r = innerR + (outerR - innerR) * (p.score / 100);
          return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
        }).join(" ")}
        fill="hsl(var(--primary) / 0.08)"
        stroke="hsl(var(--primary) / 0.35)"
        strokeWidth="1"
      />

      {/* center score */}
      <circle cx={cx} cy={cy} r={innerR - 2} fill="hsl(var(--card))" stroke="hsl(var(--border))" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="600"
            fill="hsl(var(--primary))" letterSpacing="-0.02em">{overall}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" letterSpacing="0.12em"
            fill="hsl(var(--muted-foreground))" textTransform="uppercase">OVERALL</text>
    </svg>
  );
}

function PillarNarrative({ pillar, navigate }) {
  const narratives = {
    skills: {
      body: [
        "Your portfolio is healthier than the median for 3 PQE privacy solicitors. The mean half-life on your top ten skills sits at 33 months, against a 24-month cohort median — the lift is almost entirely the AI Governance cluster, which moved from a flat zero to a measurable presence in nine months.",
        "EU AI Act is now your fifth-strongest skill at 78, ahead of every senior-associate peer we track. AI Risk Classification and ISO/IEC 42001 are both still climbing. The August 2 deadline will compress more of your matter list into this cluster, not less — the trajectory is doing what we hoped.",
        "Two items are decaying: Subject Access Requests (18-month half-life, 64% exposure) and the Trade Mark residue from your trainee IP seat. Both are fine to let go — SAR work is being de-leveled by tooling, and Trade Mark was never something you actively marketed. Don't defend either. ePrivacy/PECR is softening too, but stays in the portfolio until the ePrivacy Regulation finally lands.",
      ],
      actions: [
        { label: "Open skill portfolio", route: "/careeros/skills", icon: "brain" },
        { label: "See bridge skills for top target", route: "/careeros/market", icon: "trending" },
      ],
    },
    market: {
      body: [
        "AI Governance Counsel postings in your geo are up 22% over the last 90 days, demand index 168 against a base of 100 twelve months ago. The August 2 high-risk obligations are an enforceable date, not a soft policy timeline — that's why the curve is steepening rather than flattening as we approach.",
        "Your fit against the top adjacent shape — Responsible AI / In-house Counsel at a frontier lab — sits at 84%. Three bridge skills, two of them already rising (NIST AI RMF, Algorithmic Auditing). The remaining gap is technical literacy; fast.ai Part 1 has closed more of it than your dataset suggests on first read.",
        "Compensation: market p50 for the top target is £198k against your current £125k. The frontier-lab band runs higher (p75 £235k, p90 £290k with equity above that); the UK public-sector band runs lower (£85–110k) but the policy work is the closest fit to your declared preference. The Big Four advisory shape is the highest comp-to-skill match if you're optimising for total comp.",
      ],
      actions: [
        { label: "Open market intel", route: "/careeros/market", icon: "trending" },
      ],
    },
    network: {
      body: [
        "You're well-connected among privacy and tech-transactional practitioners in London — SCL, IAPP, Bird & Bird alumni network are all healthy. The thin spot is the technical AI-researcher and Responsible AI operator population, which is the audience that opens frontier-lab in-house doors and writes the references that move them.",
        "We're not going to suggest LinkedIn-spam. A practical, low-cost move for this quarter: pick three of the authors on the GovAI / Ada Lovelace / Anthropic Policy items you've bookmarked and write one substantive reply or one short piece engaging with their thinking. Public writing tagged at those communities is the lowest-effort, highest-yield network move for your specific target.",
      ],
      actions: [
        { label: "Open AI Updates feed", route: "/careeros/feed", icon: "news" },
      ],
    },
    direction: {
      body: [
        "Your strongest pillar by a margin. Three target shapes ranked in writing, the matter list aligns with shape #1, your continuing-competence record aligns with the entire cluster, and the bookmarked items show a coherent reading curriculum. That is rare; most lawyers at your stage oscillate between two and three targets.",
        "The watch-out: a clear target makes you bad at noticing the off-target opportunity that would actually be better. Once a quarter, deliberately look at the Big Four AI advisory and the FS in-house shapes, even if you ignore them. The Director role at a Big Four practice carries comp and breadth advantages that are easy to underweight from inside private practice.",
      ],
      actions: [
        { label: "See adjacent role shapes", route: "/careeros/market", icon: "compass" },
      ],
    },
    resilience: {
      body: [
        "Comp runway is healthy — Bird & Bird associate compensation supports a six-to-nine-month search without lifestyle compromise. Your SRA Practising Certificate is current; the continuing competence record is robust and well-documented across the AIGP, the CIPM, the IAPP attendances, and the in-progress ISO 42001 Lead Implementer.",
        "Resilience here is also about optionality. With three target shapes ranked, four adjacent roles within four bridge-skills, a portfolio moving in the right direction, and an enforceable August 2 deadline creating natural buyer urgency in your target market, you have unusually good degrees of freedom. Don't waste them — interview into multiple shapes, accept the one that actually serves the decade, not the one that comes first.",
      ],
      actions: [
        { label: "Review salary runway", route: "/careeros/market", icon: "shield" },
      ],
    },
  };
  const n = narratives[pillar.id];
  if (!n) return null;

  return (
    <section id={`pillar-${pillar.id}`} className="card padded voice-target" data-voice={`pillar-${pillar.id}`} style={{ scrollMarginTop: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, marginBottom: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Pillar · {pillar.id}</div>
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{pillar.name}</h2>
          <div className="small" style={{ marginTop: 6, maxWidth: 480 }}>{pillar.blurb}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.024em", color: "hsl(var(--primary))" }}>{pillar.score}</div>
          <Pill tone={pillar.delta >= 0 ? "rising" : "declining"}>
            <Icon name={pillar.delta >= 0 ? "arrow_up" : "arrow_down"} size={11} />
            {pillar.delta > 0 ? `+${pillar.delta}` : pillar.delta} this quarter
          </Pill>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {n.body.map((p, i) => (
          <p key={i} className="serif" style={{
            fontSize: 16,
            lineHeight: 1.65,
            color: "hsl(var(--foreground) / 0.88)",
            textWrap: "pretty",
          }}>{p}</p>
        ))}
      </div>

      {n.actions && (
        <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
          {n.actions.map(a => (
            <button key={a.label} className="btn primary" onClick={() => navigate(a.route)}>
              <Icon name={a.icon} size={14} /> {a.label}
            </button>
          ))}
          <button className="btn">
            <Icon name="download" size={14} /> Pin to brain
          </button>
        </div>
      )}
    </section>
  );
}

function HealthReportScreen({ navigate }) {
  const h = window.HEALTH;

  return (
    <div className="page-enter">
      {/* HERO */}
      <div className="card sage-halo" style={{ padding: "36px 40px 32px", marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 36, alignItems: "center" }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Career Health Report · Q2 · {h.generated}</div>
            <h1 className="h-display serif" style={{
              fontSize: 38, fontWeight: 500, letterSpacing: "-0.024em",
              fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic",
              maxWidth: 540, lineHeight: 1.15,
            }}>
              The pivot is realistic and the deadline is on your side.
            </h1>
            <p className="body" style={{ marginTop: 16, maxWidth: 540, fontSize: 14.5, lineHeight: 1.6 }}>
              {h.narrative_intro}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 22, flexWrap: "wrap" }}>
              <button className="btn primary"><Icon name="download" size={14} /> Download PDF</button>
              <button className="btn"><Icon name="external" size={14} /> Append to brain</button>
              <button className="btn ghost">View previous reports</button>
            </div>
          </div>

          <div style={{ display: "grid", placeItems: "center" }}>
            <PillarRadial pillars={h.pillars} overall={h.overall} />
          </div>
        </div>

        {/* Pillar nav strip */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10,
          marginTop: 28, paddingTop: 22, borderTop: "1px solid hsl(var(--border))",
        }}>
          {h.pillars.map(p => (
            <a key={p.id} href={`#pillar-${p.id}`} className="voice-target" data-voice={`pillar-strip-${p.id}`} style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
              display: "flex", flexDirection: "column", gap: 6,
              transition: "background-color 0.16s, transform 0.16s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "hsl(var(--surface-1))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "hsl(var(--card))"; }}
            >
              <div className="micro">{p.name}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: "hsl(var(--primary))" }}>{p.score}</div>
                <Pill tone={p.delta >= 0 ? "rising" : "declining"}>
                  {p.delta > 0 ? `+${p.delta}` : p.delta}
                </Pill>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Narrative sections */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 240px", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {h.pillars.map(p => (
            <PillarNarrative key={p.id} pillar={p} navigate={navigate} />
          ))}

          {/* Closing */}
          <div className="card padded sage-halo voice-target" data-voice="three-moves">
            <div className="eyebrow" style={{ marginBottom: 8 }}>This quarter, in three moves</div>
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { t: "Finish ISO/IEC 42001 Lead Implementer and one client conformity assessment.", b: "The certification crosses the threshold where in-house hiring managers treat it as a marketable credential. Pair it with one client-side conformity workflow you can describe end-to-end in interview." },
                { t: "Publish one substantive piece on the privacy–AI governance boundary.", b: "SCL guest article or a Privacy Laws & Business follow-up. Tag the GovAI and Ada Lovelace audiences. This is your highest-leverage network move and your strongest qualifier for the public-sector and frontier-lab shapes." },
                { t: "Open one real interview loop, not a polite coffee.", b: "Top adjacent role is 84% fit — Responsible AI Counsel at a frontier lab. Apply once, with intent. The August 2 deadline gives you natural buyer urgency that will not exist by Q4." },
              ].map((step, i) => (
                <li key={step.t} style={{ display: "flex", gap: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 999,
                    background: "hsl(var(--primary))",
                    color: "white", flexShrink: 0,
                    display: "grid", placeItems: "center",
                    fontWeight: 600, fontSize: 13,
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, marginBottom: 3 }}>{step.t}</div>
                    <div className="body" style={{ fontSize: 13 }}>{step.b}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* TOC rail */}
        <aside style={{ position: "sticky", top: 80, alignSelf: "flex-start" }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>In this report</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {h.pillars.map(p => (
              <a key={p.id} href={`#pillar-${p.id}`} className="nav-item" style={{ paddingLeft: 12 }}>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span className="mono micro">{p.score}</span>
              </a>
            ))}
          </nav>
          <hr className="div" style={{ margin: "14px 0" }} />
          <div className="micro" style={{ lineHeight: 1.6 }}>
            Generated from your portfolio, market caches, and feed engagement over the last 90 days. Pillars are recomputed monthly; the narrative ships quarterly.
          </div>
        </aside>
      </div>
    </div>
  );
}

window.HealthReportScreen = HealthReportScreen;
