/* /careeros/feed — personalised AI news, skill-clustered */

function RelevanceRing({ value = 0, size = 32 }) {
  const r = (size / 2) - 3;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--surface-2))" strokeWidth="3" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
                strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="mono" style={{
        position: "absolute", inset: 0, display: "grid", placeItems: "center",
        fontSize: 9.5, fontWeight: 600, color: "hsl(var(--primary))"
      }}>
        {Math.round(value * 100)}
      </div>
    </div>
  );
}

function FeedScreen({ navigate }) {
  const feed = window.FEED;
  const [openCluster, setOpenCluster] = React.useState(feed[0].cluster);

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="AI Updates feed · Module 3.1 · Updated 22m ago"
        title="What moved your skills today."
        sub="Items are clustered by which of your skills they affect. Relevance combines portfolio weight, target-role distance, and recency. Juno's one-line take is a draft — never blindly trusted."
        actions={
          <>
            <button className="btn"><Icon name="filter" size={14} /> All sources</button>
            <button className="btn"><Icon name="settings" size={14} /> Tune relevance</button>
          </>
        }
      />

      {/* Quick filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <div className="tabs">
          <button className="tab active">By skill</button>
          <button className="tab">By recency</button>
          <button className="tab">By source</button>
          <button className="tab">Bookmarked</button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div className="small">Showing</div>
          <Pill solid>{feed.reduce((acc, c) => acc + c.items.length, 0)} items</Pill>
          <div className="small">across</div>
          <Pill solid>{feed.length} skill clusters</Pill>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 22 }}>
        {/* Clusters list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {feed.map(cluster => {
            const isOpen = openCluster === cluster.cluster;
            return (
              <div key={cluster.cluster} className="card" style={{ overflow: "hidden" }}>
                <button
                  onClick={() => setOpenCluster(isOpen ? null : cluster.cluster)}
                  style={{
                    width: "100%", border: "none", background: "transparent",
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 22px",
                    textAlign: "left", color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <RelevanceRing value={cluster.relevance} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{cluster.cluster}</div>
                      <Pill>{cluster.items.length} item{cluster.items.length === 1 ? "" : "s"}</Pill>
                    </div>
                    <div className="small" style={{ fontSize: 12.5 }}>{cluster.why}</div>
                  </div>
                  <Icon name={isOpen ? "chevron_down" : "chevron_right"} size={16} style={{ color: "hsl(var(--muted-foreground))" }} />
                </button>

                {isOpen && (
                  <div style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    {cluster.items.map((it, idx) => (
                      <article key={idx} style={{
                        padding: "18px 22px",
                        borderBottom: idx === cluster.items.length - 1 ? "none" : "1px solid hsl(var(--border))",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span className="micro" style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{it.source}</span>
                          <span className="micro" style={{ opacity: 0.4 }}>·</span>
                          <Pill>{it.kind}</Pill>
                          <span className="micro" style={{ opacity: 0.4 }}>·</span>
                          <span className="micro">{it.time} ago</span>
                          <span className="micro" style={{ marginLeft: "auto" }}>
                            <Icon name="clock" size={11} style={{ verticalAlign: "-2px" }} /> {it.read_mins}m read
                          </span>
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, marginBottom: 10, letterSpacing: "-0.012em" }}>{it.title}</h3>
                        <div style={{
                          background: "hsl(var(--surface-1))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          padding: "10px 12px",
                          display: "flex", gap: 10, alignItems: "flex-start",
                          marginBottom: 12,
                        }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 999,
                            background: "hsl(var(--primary))",
                            color: "white", flexShrink: 0,
                            display: "grid", placeItems: "center",
                            fontSize: 11, fontWeight: 600,
                            fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic",
                          }}>J</div>
                          <div className="body" style={{ fontSize: 12.5, color: "hsl(var(--foreground) / 0.84)" }}>
                            {it.take}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn sm primary">Read <Icon name="external" size={11} /></button>
                          <button className="btn sm"><Icon name="bookmark" size={11} /> Save</button>
                          <button className="btn ghost sm"><Icon name="zap" size={11} /> Append to brain</button>
                          <button className="btn ghost sm" style={{ marginLeft: "auto" }}>
                            <Icon name="alert" size={11} /> Less like this
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Relevance model</div>
            <div className="body" style={{ fontSize: 12.5 }}>
              Items are scored against your portfolio weights and target-role distance, then decayed by age.
              Skills in the at-risk tier are muted; skills you're growing fastest get amplified.
            </div>
            <hr className="div" style={{ margin: "12px 0" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Portfolio weight", val: 0.45 },
                { label: "Target-role distance", val: 0.3 },
                { label: "Recency", val: 0.18 },
                { label: "Quality signal", val: 0.07 },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span>{f.label}</span>
                    <span className="mono micro">{Math.round(f.val * 100)}%</span>
                  </div>
                  <Meter value={f.val * 100} size="sm" />
                </div>
              ))}
            </div>
          </div>

          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Sources today</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { name: "EU AI Office", count: 3 },
                { name: "ICO",         count: 4 },
                { name: "IAPP",        count: 5 },
                { name: "Anthropic Policy", count: 2 },
                { name: "OpenAI",      count: 1 },
                { name: "AI Security Institute", count: 1 },
                { name: "GovAI",       count: 1 },
                { name: "Ada Lovelace Institute", count: 1 },
                { name: "Stanford HAI", count: 1 },
                { name: "SCL",         count: 1 },
              ].map(s => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span>{s.name}</span>
                  <span className="mono micro">{s.count}</span>
                </div>
              ))}
            </div>
            <hr className="div" style={{ margin: "12px 0" }} />
            <button className="btn ghost sm" style={{ padding: 0 }}>Manage 34 sources <Icon name="arrow_right" size={12} /></button>
          </div>

          <div className="card padded sage-halo">
            <div className="eyebrow" style={{ marginBottom: 8 }}>Pushed to brain</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.024em", color: "hsl(var(--primary))" }}>14</div>
              <div className="small">items this month</div>
            </div>
            <div className="small" style={{ marginTop: 6 }}>
              Items you've appended become context Juno can see when scoped to your workspace.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.FeedScreen = FeedScreen;
