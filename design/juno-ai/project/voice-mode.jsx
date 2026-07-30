/* Voice mode: scripted demo scenes that drive the prototype.
   The agent narrates, the GUI lights up where it's pointing. */

const SCENES = [
  {
    id: "standup",
    title: "Daily standup",
    sub: "60-second morning briefing",
    icon: "spark",
    route: "/career/dashboard",
    turns: [
      { who: "user",  text: "Morning Juno. What's the picture today?", listenMs: 800 },
      { who: "juno",  text: "Morning Eleanor. Sixty-second version, then we'll go deeper if you want." },
      { who: "juno",  text: "Twelve new feed items overnight. Two moved your EU AI Act cluster — I bookmarked the EU AI Office's draft delegated act narrowing Article 6(2), and Anthropic's first public system-card template for high-risk classification reviews.", target: "hero-status" },
      { who: "juno",  text: "One real skill movement: ISO 42001 climbed four points this week, lifted by your Lead Implementer progress and a market signal — BSI just published the first wave of UK certifications, two of them your clients.", target: "skill-snapshot" },
      { who: "juno",  text: "Your overall Career Health ticked up two to 80. Direction at 90 is still anchoring; Network nudged up after the SCL panel but it's still the soft pillar.", target: "health-card" },
      { who: "juno",  text: "AI Governance Counsel postings in your geo gained 22% this quarter. The August 2 deadline is doing the work. Walk through the Health Report, or queue up the day?" },
      { who: "user",  text: "Health Report, briefly.", listenMs: 600 },
      { who: "action", text: "Navigating to /careeros/health-report", icon: "arrow_right" },
      { route: "/careeros/health-report" },
    ],
  },
  {
    id: "health",
    title: "Health Report debrief",
    sub: "Pillar-by-pillar walkthrough",
    icon: "heart",
    route: "/careeros/health-report",
    turns: [
      { who: "juno", text: "Quarterly Career Health Report. Overall is 80, up six. The pivot is realistic and the deadline is on your side." },
      { who: "juno", text: "Direction at 90 is your strongest pillar. Three target shapes ranked in writing, matter list aligns with shape one, continuing-competence record matches across all three. Most lawyers at 3 PQE oscillate between two and three targets — you don't.", target: "pillar-strip-direction" },
      { who: "juno", text: "Skills moved 11 points to 82. Almost all from the AI Governance cluster compounding — EU AI Act is your fifth-strongest skill now, ahead of every senior-associate peer we track.", target: "pillar-strip-skills" },
      { who: "juno", text: "Network is the slipping pillar — 70, up only three. SCL and IAPP attendance lifted it slightly, but you're still thin on the Responsible AI operator population that opens frontier-lab in-house doors.", target: "pillar-strip-network" },
      { who: "juno", text: "I have one concrete move for that. It's in the action list at the bottom.", target: "three-moves" },
      { who: "juno", text: "Three moves this quarter, in priority. One: finish ISO 42001 Lead Implementer and one client conformity assessment. Two: publish one substantive piece on the privacy–AI governance boundary. Three: open one real interview loop." },
      { who: "user", text: "Tell me more about Subject Access Requests being at-risk.", listenMs: 1000 },
      { who: "action", text: "Navigating to /careeros/skills, focusing on Subject Access Requests", icon: "arrow_right" },
      { route: "/careeros/skills" },
    ],
  },
  {
    id: "skill-drill",
    title: "Skill drill-down",
    sub: "Why are Subject Access Requests at-risk?",
    icon: "brain",
    route: "/careeros/skills",
    turns: [
      { who: "user", text: "Why are Subject Access Requests flagged at-risk?", listenMs: 900 },
      { who: "juno", text: "Two reasons stacked together. Half-life is 18 months — that's short. And AI-exposure score is 64, which is high. OneTrust shipped a SAR copilot in March, three vendors followed in April.", target: "skill-subject-access-requests" },
      { who: "juno", text: "The pattern reads as de-leveling, not extinction. The role isn't disappearing — it's moving down. Paralegal-led with model-assisted drafting, not senior-associate-led with bespoke advice." },
      { who: "juno", text: "For your trajectory that's actually clean. At 3 PQE pivoting into AI Governance you don't need SAR depth as a marketed skill — it shows up automatically in the privacy CV without being a load-bearing pillar.", target: "coach-summary" },
      { who: "juno", text: "I'd put SAR work in the sunset column with the Trade Mark trainee-seat residue. Don't defend either. Spend the protected cycles on ISO 42001 and one client conformity workflow you can describe end-to-end in interview." },
      { who: "user", text: "Draft me a sunset plan and a focus plan.", listenMs: 1100 },
      { who: "action", text: "Drafting sunset plan + ISO 42001 focus plan, will surface in inbox", icon: "sparkles" },
      { who: "juno", text: "Done. Six-week sunset, twelve-week focus, four checkpoints each. Drafts are in your Juno inbox. I'll ask at the next standup." },
    ],
  },
  {
    id: "apply",
    title: "Apply to top match",
    sub: "Agent runs the multi-step",
    icon: "compass",
    route: "/careeros/market",
    turns: [
      { who: "user", text: "Apply me to the top match.", listenMs: 800 },
      { who: "juno", text: "Top match is Responsible AI Counsel at a frontier lab in London. Eighty-four percent fit, three bridge skills — Technical AI/ML Literacy, Algorithmic Auditing, NIST AI RMF — two already rising in your portfolio.", target: "adjacent-0" },
      { who: "juno", text: "Before I send anything, three things to confirm. Comp expectations, cover letter draft, and CV version." },
      { who: "juno", text: "On comp — UK senior counsel band at frontier labs anchors at £195k base, plus equity. That's your target band p75. Should I anchor there?" },
      { who: "user", text: "Yes, £195k base, open on equity. Don't commit on relocation.", listenMs: 1200 },
      { who: "action", text: "Pulling whitfield_cv_v6.pdf + Privacy Laws & Business piece + AIGP credential", icon: "external" },
      { who: "juno", text: "Drafting now. The lead is the Series B AI infra Article 6 conformity work — that's the matter that maps most cleanly onto what their Responsible AI team actually does. Anchor proof points: AIGP certification, ISO 42001 in progress, and the SCL panel." },
      { who: "juno", text: "I'll also queue a calendar block for the recruiter screen plus a prep doc that pulls from your Skills pillar and the bridge-skill list. SRA conduct check — confidentiality, no firm-attributable matter detail. Sound right?" },
      { who: "user", text: "Perfect. Send when ready.", listenMs: 800 },
      { who: "action", text: "Application queued · cover letter pending your review · SRA disclosure check passed", icon: "check" },
    ],
  },
];

/* ---------- helpers ---------- */

function clearHighlights() {
  document.querySelectorAll(".voice-target.active").forEach(el => el.classList.remove("active"));
}

function highlightTarget(name) {
  clearHighlights();
  if (!name) return;
  const el = document.querySelector(`[data-voice="${name}"]`);
  if (!el) return;
  el.classList.add("active");
  // scroll into view, centered
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* Typewriter: returns the visible text given an elapsed ms and full text */
function typed(text, elapsed) {
  const CHARS_PER_SEC = 28; // ~ natural-ish reading cadence
  const chars = Math.min(text.length, Math.floor((elapsed / 1000) * CHARS_PER_SEC));
  return text.slice(0, chars);
}

/* ---------- VoiceDock (always-on) ---------- */

function VoiceDock({ active, onPick, onStop, currentSceneId }) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  if (active) {
    return null; // panel handles controls while active
  }

  return (
    <div className="voice-dock">
      <button
        className="mic"
        title="Hold to speak (demo: click to launch a scripted scene)"
        onClick={() => setMenuOpen(o => !o)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" />
        </svg>
      </button>
      <div className="hint">
        <span className="label">Hold to speak</span>
        <span className="sub">or pick a scenario →</span>
      </div>
      <div style={{ position: "relative" }} ref={menuRef}>
        <button className="scene-btn" onClick={() => setMenuOpen(o => !o)}>
          Scenes
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {menuOpen && (
          <div className="scene-menu" onClick={(e) => e.stopPropagation()}>
            <div className="scene-head">Voice scenarios</div>
            {SCENES.map(s => (
              <button key={s.id} className="scene-row" onClick={() => { setMenuOpen(false); onPick(s); }}>
                <div className="ico"><Icon name={s.icon} size={15} /></div>
                <div style={{ flex: 1 }}>
                  <div className="t">{s.title}</div>
                  <div className="s">{s.sub}</div>
                </div>
                <Icon name="arrow_right" size={14} style={{ color: "hsl(var(--muted-foreground))" }} />
              </button>
            ))}
            <div style={{ padding: "8px 12px 4px", borderTop: "1px solid hsl(var(--border))", marginTop: 4 }}>
              <div className="small" style={{ fontSize: 11.5, lineHeight: 1.4 }}>
                Scripted to demonstrate the agent's behavior — narrates, navigates, highlights what it's referencing, and queues actions.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- VoicePanel (active conversation) ---------- */

function VoicePanel({ scene, turnIdx, transcript, partial, status, onEnd, onSkip }) {
  const trackRef = React.useRef(null);
  React.useEffect(() => {
    if (trackRef.current) trackRef.current.scrollTop = trackRef.current.scrollHeight;
  }, [transcript.length, partial]);

  const wave = (
    <div className={`voice-wave ${status === "idle" ? "idle" : ""}`}>
      {Array.from({ length: 8 }).map((_, i) => <span key={i} />)}
    </div>
  );

  const statusLabel =
    status === "listening" ? "Listening" :
    status === "thinking"  ? "Thinking"  :
    status === "speaking"  ? "Speaking"  :
    status === "acting"    ? "Acting"    :
    status === "done"      ? "Ready"     : "Connected";

  return (
    <div className="voice-panel">
      <div className="voice-panel-head">
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: "hsl(var(--primary))",
          color: "white",
          display: "grid", placeItems: "center",
          fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic",
          fontWeight: 600, fontSize: 13,
        }}>J</div>
        <div style={{ flex: 1 }}>
          <div className="voice-panel-title">Juno · {scene.title}</div>
          <div className="voice-panel-sub">{statusLabel} · {turnIdx + 1} / {scene.turns.length}</div>
        </div>
        {wave}
      </div>

      <div className="voice-transcript" ref={trackRef}>
        {transcript.map((t, i) => (
          <div key={i} className={`voice-turn ${t.who}`}>
            {t.who === "action"
              ? <div className="bubble">{t.icon && <Icon name={t.icon} size={11} />} {t.text}</div>
              : (
                <>
                  <div className="who">{t.who === "juno" ? "J" : "M"}</div>
                  <div className="bubble">{t.text}</div>
                </>
              )
            }
          </div>
        ))}
        {partial && (
          <div className={`voice-turn ${partial.who}`}>
            {partial.who === "action"
              ? <div className="bubble">{partial.icon && <Icon name={partial.icon} size={11} />} {partial.text}</div>
              : (
                <>
                  <div className="who">{partial.who === "juno" ? "J" : "M"}</div>
                  <div className="bubble">
                    {partial.text}
                    <span className="cursor" />
                  </div>
                </>
              )
            }
          </div>
        )}
      </div>

      <div className="voice-controls">
        <button className="btn sm" onClick={onSkip}>
          <Icon name="arrow_right" size={12} /> Next
        </button>
        <span className="micro" style={{ color: "hsl(var(--muted-foreground))" }}>
          Tap and hold the mic to interject · or end the call to dismiss
        </span>
        <button className="end-btn" style={{ marginLeft: "auto" }} onClick={onEnd}>
          End call
        </button>
      </div>
    </div>
  );
}

/* ---------- Voice controller ----------
   Plays a scene's turns sequentially. Exposes start/stop/skip. */
function useVoiceController({ active, scene, navigate, onEnd }) {
  const [turnIdx, setTurnIdx] = React.useState(0);
  const [transcript, setTranscript] = React.useState([]); // committed turns
  const [partial, setPartial] = React.useState(null);     // currently-speaking
  const [status, setStatus] = React.useState("idle");
  const turnTimer = React.useRef(null);
  const typeTimer = React.useRef(null);
  const cancelled = React.useRef(false);

  const clearTimers = () => {
    if (turnTimer.current) clearTimeout(turnTimer.current);
    if (typeTimer.current) clearInterval(typeTimer.current);
  };

  // Reset when scene changes or activated
  React.useEffect(() => {
    if (!active || !scene) return;
    cancelled.current = false;
    setTurnIdx(0);
    setTranscript([]);
    setPartial(null);
    setStatus("connected");
    return () => {
      cancelled.current = true;
      clearTimers();
      clearHighlights();
    };
  }, [active, scene && scene.id]);

  // Step through turns
  React.useEffect(() => {
    if (!active || !scene) return;
    if (turnIdx >= scene.turns.length) {
      setStatus("done");
      return;
    }
    const turn = scene.turns[turnIdx];

    // Route-only turn (navigate then advance)
    if (turn.route) {
      setStatus("acting");
      navigate(turn.route);
      turnTimer.current = setTimeout(() => {
        if (!cancelled.current) setTurnIdx(i => i + 1);
      }, 600);
      return () => clearTimers();
    }

    // Highlight target
    if (turn.target) {
      // small delay so highlight syncs with speech start
      setTimeout(() => { if (!cancelled.current) highlightTarget(turn.target); }, 120);
    } else if (turn.who !== "action") {
      // clear highlight on non-targeted turn (keep for action turns)
      clearHighlights();
    }

    // Status
    if (turn.who === "user")   setStatus("listening");
    else if (turn.who === "action") setStatus("acting");
    else setStatus("speaking");

    // Animate the turn
    const startedAt = Date.now();
    const fullText = turn.text || "";
    const isUser = turn.who === "user";
    const isAction = turn.who === "action";
    // user "listening" pause before showing text
    const listenPause = isUser ? (turn.listenMs || 600) : 0;
    // total duration: action = 1.6s flat; user = listenPause + 250ms typewrite; juno = typewrite at 28 cps + 600ms hold
    const charsPerMs = 28 / 1000;
    const typewriteMs = Math.max(800, fullText.length / charsPerMs);
    const holdAfter = isAction ? 1200 : isUser ? 400 : 600;

    setPartial({ ...turn, text: "" });

    if (isUser) {
      // pause then snap in
      typeTimer.current = setTimeout(() => {
        if (cancelled.current) return;
        setPartial({ ...turn, text: fullText });
      }, listenPause);
    } else if (isAction) {
      setPartial({ ...turn, text: fullText });
    } else {
      // juno: typewriter
      typeTimer.current = setInterval(() => {
        if (cancelled.current) return;
        const e = Date.now() - startedAt;
        const t = typed(fullText, e);
        setPartial({ ...turn, text: t });
        if (t.length >= fullText.length) clearInterval(typeTimer.current);
      }, 32);
    }

    // commit + advance
    const totalDuration = listenPause + (isUser ? 250 : typewriteMs) + holdAfter;
    turnTimer.current = setTimeout(() => {
      if (cancelled.current) return;
      setTranscript(prev => [...prev, { ...turn, text: fullText }]);
      setPartial(null);
      setTurnIdx(i => i + 1);
    }, totalDuration);

    return () => clearTimers();
  }, [turnIdx, active, scene && scene.id]);

  const skip = React.useCallback(() => {
    clearTimers();
    if (partial) {
      setTranscript(prev => [...prev, { ...partial, text: scene.turns[turnIdx].text || "" }]);
      setPartial(null);
    }
    setTurnIdx(i => i + 1);
  }, [partial, scene, turnIdx]);

  const stop = React.useCallback(() => {
    cancelled.current = true;
    clearTimers();
    clearHighlights();
    setTranscript([]);
    setPartial(null);
    setTurnIdx(0);
    setStatus("idle");
    if (onEnd) onEnd();
  }, [onEnd]);

  return { turnIdx, transcript, partial, status, skip, stop };
}

/* ---------- VoiceLayer (root) ---------- */

function VoiceLayer({ navigate, currentPath }) {
  const [scene, setScene] = React.useState(null);
  const active = !!scene;

  React.useEffect(() => {
    if (active) document.body.classList.add("voice-active");
    else document.body.classList.remove("voice-active");
  }, [active]);

  const ctrl = useVoiceController({
    active,
    scene,
    navigate,
    onEnd: () => setScene(null),
  });

  const handlePick = (s) => {
    // navigate to scene's home route, then activate
    navigate(s.route);
    setTimeout(() => setScene(s), 80);
  };

  return (
    <>
      <div className="voice-vignette" />
      <VoiceDock active={active} onPick={handlePick} currentSceneId={scene?.id} />
      {active && (
        <VoicePanel
          scene={scene}
          turnIdx={ctrl.turnIdx}
          transcript={ctrl.transcript}
          partial={ctrl.partial}
          status={ctrl.status}
          onEnd={ctrl.stop}
          onSkip={ctrl.skip}
        />
      )}
    </>
  );
}

Object.assign(window, { VoiceLayer, SCENES });
