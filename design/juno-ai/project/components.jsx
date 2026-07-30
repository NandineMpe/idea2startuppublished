/* Shared UI components for CareerOS prototype.
   Inline SVG icons (no external icon font dependency at runtime). */

const ICON_PATHS = {
  home:      "M3 12 12 3l9 9M5 10v10h4v-6h6v6h4V10",
  layers:    "M12 2 2 7l10 5 10-5-10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  brain:     "M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2zM14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z",
  trending:  "M22 7 13.5 15.5l-5-5L2 17M16 7h6v6",
  news:      "M4 22h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8z",
  heart:     "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
  sparkles:  "M9.94 14.34 8.5 18l-1.44-3.66L3.4 12.9l3.66-1.44L8.5 7.8l1.44 3.66 3.66 1.44-3.66 1.44ZM20 3v4M22 5h-4M19 17v4M21 19h-4",
  settings:  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.08-1.1l2.1-1.65-2-3.46-2.49.99a7.5 7.5 0 0 0-1.9-1.1L14.7 2h-4l-.33 2.68a7.5 7.5 0 0 0-1.9 1.1l-2.5-1-2 3.47 2.1 1.65A7.4 7.4 0 0 0 4.5 12c0 .37.03.74.08 1.1l-2.1 1.65 2 3.46 2.49-.99a7.5 7.5 0 0 0 1.9 1.1L9.3 22h4l.33-2.68a7.5 7.5 0 0 0 1.9-1.1l2.5 1 2-3.47-2.1-1.65c.05-.36.07-.73.07-1.1Z",
  upload:    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  bell:      "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M13.7 21a2 2 0 0 1-3.4 0",
  search:    "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  arrow_right: "M5 12h14M13 5l7 7-7 7",
  arrow_up_right: "M7 17 17 7M7 7h10v10",
  arrow_up:  "M12 19V5M5 12l7-7 7 7",
  arrow_down: "M12 5v14M5 12l7 7 7-7",
  check:     "M20 6 9 17l-5-5",
  clock:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
  alert:     "M12 8v4M12 16h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z",
  external:  "M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5",
  bookmark:  "m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z",
  filter:    "M3 6h18M7 12h10M10 18h4",
  dot:       "M12 12h.01",
  pin:       "M12 22V12M5 4h14l-2 8H7L5 4Z",
  building:  "M4 22V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18M9 22V12h6v10M9 6h6M9 9h6",
  badge:     "M10.5 2a2.5 2.5 0 0 1 3 0l2 .5L17 5l.5 2 .5 2-1.5 1.5L17 13l-1.5 2-2 .5L12 17l-1.5-1.5-2-.5L7 13l-.5-2L5 9.5 6.5 7 7 5l1.5-2.5L10.5 2zM9 14l-3 8 4-2 2 3 4-9",
  graduation:"M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5",
  spark:     "M10 13.4 13 16l5-5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  zap:       "M13 2 3 14h7l-1 8 10-12h-7l1-8Z",
  chevron_right: "m9 18 6-6-6-6",
  chevron_down: "m6 9 6 6 6-6",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  network: "M16 4a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM2 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM16 20a3 3 0 1 1 6 0 3 3 0 0 1-6 0ZM8 12h8M13 7l3 11",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM16 8l-2 6-6 2 2-6 6-2Z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
  flag: "M4 22V4a2 2 0 0 1 2-2h11l-3 5 3 5H6M4 22h2",
  map: "M3 6v15l6-3 6 3 6-3V3l-6 3-6-3-6 3ZM9 3v15M15 6v15",
};

function Icon({ name, size = 16, stroke = 1.7, ...rest }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}

/* Sparkline */
function Sparkline({ data = [], width = 80, height = 22, stroke, fill, area = false }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = (max - min) || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - 1 - ((v - min) / span) * (height - 2);
    return [x, y];
  });
  const path = pts.map(([x,y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const areaPath = `${path} L${width-1},${height-1} L1,${height-1} Z`;
  return (
    <svg width={width} height={height} className="spark" viewBox={`0 0 ${width} ${height}`}>
      {area && <path d={areaPath} fill={fill || "currentColor"} fillOpacity="0.12" />}
      <path d={path} fill="none" stroke={stroke || "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Meter */
function Meter({ value = 0, max = 100, tone = "primary", size = "md", trailing }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const toneVar = {
    primary: "var(--primary)",
    rising:   "var(--status-rising)",
    stable:   "var(--status-stable)",
    declining:"var(--status-declining)",
    "at-risk":"var(--status-risk)",
  }[tone] || "var(--primary)";
  return (
    <div className={`meter ${size === "sm" ? "thin" : size === "lg" ? "thick" : ""}`}>
      <div className="fill" style={{ width: `${pct}%`, background: `hsl(${toneVar})` }} />
    </div>
  );
}

/* Pill (with status mode) */
function Pill({ children, tone, solid, ...rest }) {
  const cls = ["pill"];
  if (solid) cls.push("solid");
  if (tone) cls.push(tone);
  return <span className={cls.join(" ")} {...rest}>{children}</span>;
}

/* Page header with eyebrow + title + subtitle + actions */
function PageHeader({ eyebrow, title, sub, actions, children }) {
  return (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, marginBottom: 28 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</div>}
        <h1 className="h-display">{title}</h1>
        {sub && <p className="body" style={{ marginTop: 10, maxWidth: 640 }}>{sub}</p>}
        {children}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </header>
  );
}

/* Section header inside a page */
function SectionHeader({ title, right, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
      <div>
        <div className="h-section">{title}</div>
        {sub && <div className="small" style={{ marginTop: 4 }}>{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{right}</div>}
    </div>
  );
}

/* Stat block: big number + label */
function Stat({ label, value, delta, sub, tone }) {
  const deltaTone = delta == null ? null
    : delta > 0 ? "rising" : delta < 0 ? "declining" : "stable";
  return (
    <div>
      <div className="micro" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: tone === "primary" ? "hsl(var(--primary))" : undefined }}>{value}</div>
        {delta != null && (
          <Pill tone={deltaTone}>
            <Icon name={delta >= 0 ? "arrow_up" : "arrow_down"} size={11} />
            {delta > 0 ? `+${delta}` : delta}{typeof delta === "number" ? "%" : ""}
          </Pill>
        )}
      </div>
      {sub && <div className="micro" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* Source attribution pill */
function SourcePill({ source }) {
  return (
    <span className="micro" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 7px", borderRadius: 4,
      background: "hsl(var(--surface-2))",
      letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600,
      fontSize: 10,
    }}>
      <Icon name={source === "resume" ? "badge" : "external"} size={10} /> {source}
    </span>
  );
}

Object.assign(window, {
  Icon, Sparkline, Meter, Pill, PageHeader, SectionHeader, Stat, SourcePill,
});
