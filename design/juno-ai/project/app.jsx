/* Main shell: sidebar, topbar, routing, dark mode tweak */

const ROUTES = [
  { path: "/career/dashboard",       label: "Dashboard",         icon: "home",     section: "career", crumb: ["Career", "Dashboard"] },
  { path: "/careeros",               label: "Workspace home",    icon: "layers",   section: "careeros", crumb: ["CareerOS", "Workspace"] },
  { path: "/careeros/skills",        label: "Skill portfolio",   icon: "brain",    section: "careeros", crumb: ["CareerOS", "Skills"] },
  { path: "/careeros/market",        label: "Market intelligence", icon: "trending", section: "careeros", crumb: ["CareerOS", "Market"] },
  { path: "/careeros/feed",          label: "AI Updates",        icon: "news",     section: "careeros", crumb: ["CareerOS", "Feed"], badge: "12" },
  { path: "/careeros/health-report", label: "Health Report",     icon: "heart",    section: "careeros", crumb: ["CareerOS", "Health Report"] },
];

function Sidebar({ active, navigate }) {
  const careerLinks = ROUTES.filter(r => r.section === "career");
  const careerosLinks = ROUTES.filter(r => r.section === "careeros");

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">J</div>
        <div className="brand-name">Juno</div>
        <div className="brand-lane">Career</div>
      </div>

      <div className="lane-switcher" title="Career lane (active). Founder and Creator gated by middleware.">
        <button className="lane-btn" data-lane="founder" disabled title="Founder lane — gated">
          <span className="dot" /> Founder
        </button>
        <button className="lane-btn" data-lane="creator" disabled title="Creator lane — gated">
          <span className="dot" /> Creator
        </button>
        <button className="lane-btn active" data-lane="career">
          <span className="dot" /> Career
        </button>
      </div>

      <div className="nav-section">
        <div className="nav-heading">Career</div>
        {careerLinks.map(r => (
          <button key={r.path} className={`nav-item ${active === r.path ? "active" : ""}`} onClick={() => navigate(r.path)}>
            <Icon name={r.icon} size={16} className="nav-icon" />
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-heading">CareerOS</div>
        {careerosLinks.map(r => (
          <button key={r.path} className={`nav-item ${active === r.path ? "active" : ""}`} onClick={() => navigate(r.path)}>
            <Icon name={r.icon} size={16} className="nav-icon" />
            <span>{r.label}</span>
            {r.badge && <span className="nav-badge">{r.badge}</span>}
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="nav-item" style={{ cursor: "default" }}>
          <Icon name="settings" size={16} className="nav-icon" />
          <span>Settings</span>
        </div>
        <div className="user-card">
          <div className="avatar">{window.PROFILE.initials}</div>
          <div className="user-info">
            <div className="user-name">{window.PROFILE.name}</div>
            <div className="user-mail">{window.PROFILE.email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ route, navigate }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {route.crumb.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === route.crumb.length - 1 ? "here" : ""}>{c}</span>
          </React.Fragment>
        ))}
        <span className="mono micro" style={{ marginLeft: 12, color: "hsl(var(--muted-foreground))" }}>{route.path}</span>
      </div>
      <div className="top-actions">
        <button className="icon-btn" title="Search">
          <Icon name="search" size={16} />
        </button>
        <button className="icon-btn has-badge" title="Notifications">
          <Icon name="bell" size={16} />
        </button>
        <button className="btn sm" onClick={() => navigate("/careeros/health-report")}>
          <Icon name="sparkles" size={13} /> New report
        </button>
      </div>
    </div>
  );
}

function App() {
  const [path, setPath] = React.useState(() => {
    const hash = window.location.hash.replace(/^#/, "");
    return ROUTES.find(r => r.path === hash) ? hash : "/career/dashboard";
  });

  React.useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (ROUTES.find(r => r.path === h)) setPath(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = React.useCallback((to) => {
    if (ROUTES.find(r => r.path === to)) {
      window.location.hash = to;
      setPath(to);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  /* Tweaks: light/dark */
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light"
  }/*EDITMODE-END*/;
  const [t, setTweak] = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];
  React.useEffect(() => {
    if (t.theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [t.theme]);

  const route = ROUTES.find(r => r.path === path) || ROUTES[0];

  let screen;
  switch (path) {
    case "/career/dashboard":       screen = <DashboardScreen navigate={navigate} />; break;
    case "/careeros":               screen = <CareerOSHome navigate={navigate} />; break;
    case "/careeros/skills":        screen = <SkillsScreen navigate={navigate} />; break;
    case "/careeros/market":        screen = <MarketScreen navigate={navigate} />; break;
    case "/careeros/feed":          screen = <FeedScreen navigate={navigate} />; break;
    case "/careeros/health-report": screen = <HealthReportScreen navigate={navigate} />; break;
    default: screen = <DashboardScreen navigate={navigate} />;
  }

  return (
    <>
      <div className="app-shell" data-screen-label={`CareerOS — ${route.label}`}>
        <Sidebar active={path} navigate={navigate} />
        <main className="main">
          <Topbar route={route} navigate={navigate} />
          <div className="page" key={path}>
            {screen}
          </div>
        </main>
      </div>

      {window.VoiceLayer && <window.VoiceLayer navigate={navigate} currentPath={path} />}

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Appearance">
            <window.TweakRadio
              label="Theme"
              value={t.theme}
              onChange={(v) => setTweak("theme", v)}
              options={["light", "dark"]}
            />
          </window.TweakSection>
          <window.TweakSection label="Lane">
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.5, padding: "4px 0 8px" }}>
              You're in the <strong style={{ color: "hsl(var(--primary))" }}>Career</strong> lane (emerald). Founder (blue) and Creator (violet) share this chrome — only the accent color and lane label change.
            </div>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
