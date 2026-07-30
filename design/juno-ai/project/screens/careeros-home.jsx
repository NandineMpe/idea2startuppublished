/* /careeros — Workspace home (Module 1.2: extracted profile) */

function ReportProblemBtn() {
  return (
    <button className="btn ghost sm" style={{ marginLeft: "auto" }}>
      <Icon name="alert" size={12} /> Report problem
    </button>
  );
}

function CareerOSHome({ navigate }) {
  const p = window.PROFILE;
  const skills = window.SKILLS;
  const resumeSkills = skills.filter(s => s.source === "resume");
  const linkedinSkills = skills.filter(s => s.source === "linkedin");

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="CareerOS workspace"
        title="Your CareerOS profile"
        sub="Extracted from your resume and LinkedIn export. Tap report problem on any section to queue a correction for the next extraction pass."
        actions={
          <>
            <button className="btn"><Icon name="download" size={14} /> Export</button>
            <button className="btn primary"><Icon name="upload" size={14} /> Re-upload</button>
          </>
        }
      />

      {/* Profile summary */}
      <div className="card padded sage-halo" style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div className="avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{p.initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 22, fontWeight: 600 }}>{p.name}</h2>
              <span className="small">{p.email}</span>
            </div>
            <div className="body" style={{ marginTop: 6 }}>{p.headline}</div>
            <div style={{ display: "flex", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
              <Stat label="Current role" value={p.current_role_title} sub={`at ${p.current_company}`} />
              <Stat label="Years qualified" value={p.pqe_label} sub="3 PQE · admitted Sep 2023" />
              <Stat label="Current salary" value={`£${(p.current_salary_gbp/1000)|0}k`} sub="GBP, base" />
              <Stat label="Target role" value={p.target_role_title} sub="confirmed Q2" tone="primary" />
              <Stat label="Location" value={p.location_label} sub="open to UK/EU remote" />
            </div>
          </div>
          <ReportProblemBtn />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Skills from resume */}
          <div className="card">
            <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div>
                <div className="h-card">Skills from your resume</div>
                <div className="small" style={{ marginTop: 4 }}>{resumeSkills.length} skills · source: PDF upload (Apr 12)</div>
              </div>
              <ReportProblemBtn />
            </div>
            <div className="card-section">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {resumeSkills.map(s => (
                  <Pill key={s.name}>
                    {s.name}
                    <span className="micro" style={{ opacity: 0.7 }}>· {s.level}</span>
                  </Pill>
                ))}
              </div>
            </div>
          </div>

          {/* Skills from LinkedIn */}
          <div className="card">
            <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div>
                <div className="h-card">Skills from LinkedIn</div>
                <div className="small" style={{ marginTop: 4 }}>{linkedinSkills.length} skills · source: LinkedIn export (Apr 12)</div>
              </div>
              <ReportProblemBtn />
            </div>
            <div className="card-section">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {linkedinSkills.map(s => (
                  <Pill key={s.name}>
                    {s.name}
                    <span className="micro" style={{ opacity: 0.7 }}>· {s.level}</span>
                  </Pill>
                ))}
              </div>
            </div>
          </div>

          {/* Past roles */}
          <div className="card">
            <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div>
                <div className="h-card">Past roles</div>
                <div className="small" style={{ marginTop: 4 }}>{window.PAST_ROLES.length} roles · earliest 2018</div>
              </div>
              <ReportProblemBtn />
            </div>
            {window.PAST_ROLES.map((r, i) => (
              <div className="card-section" key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div className="icon-tile" style={{ width: 32, height: 32, borderRadius: 8, background: "hsl(var(--surface-2))", color: "hsl(var(--muted-foreground))" }}>
                  <Icon name="building" size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.title}</div>
                  <div className="small" style={{ marginTop: 1 }}>{r.company} · {r.start_date} – {r.end_date}</div>
                  <div className="body" style={{ marginTop: 6, fontSize: 12.5 }}>{r.note}</div>
                </div>
                {i === 0 && <Pill solid>Current</Pill>}
              </div>
            ))}
          </div>

          {/* Education */}
          <div className="card">
            <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div>
                <div className="h-card">Education</div>
                <div className="small" style={{ marginTop: 4 }}>{window.EDUCATION.length} entries</div>
              </div>
              <ReportProblemBtn />
            </div>
            {window.EDUCATION.map((e, i) => (
              <div className="card-section" key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div className="icon-tile" style={{ width: 32, height: 32, borderRadius: 8, background: "hsl(var(--surface-2))", color: "hsl(var(--muted-foreground))" }}>
                  <Icon name="graduation" size={15} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{e.institution}</div>
                  <div className="small" style={{ marginTop: 1 }}>{e.degree} · {e.field}</div>
                </div>
                <div className="micro">{e.years}</div>
              </div>
            ))}
          </div>

          {/* Notable achievements */}
          <div className="card">
            <div className="card-section" style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div>
                <div className="h-card">Notable achievements</div>
                <div className="small" style={{ marginTop: 4 }}>Lifted from documents; verify before sharing externally.</div>
              </div>
              <ReportProblemBtn />
            </div>
            <div className="card-section">
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {window.ACHIEVEMENTS.map((a) => (
                  <li key={a} style={{ display: "flex", gap: 10 }}>
                    <Icon name="check" size={14} style={{ marginTop: 2, color: "hsl(var(--primary))", flexShrink: 0 }} />
                    <span className="body">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Extraction run</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "hsl(var(--primary))" }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>Completed</span>
              <span className="micro" style={{ marginLeft: "auto" }}>3.2s</span>
            </div>
            <div className="small" style={{ marginTop: 8 }}>careeros/profile.extract · run #41</div>
            <div className="small">Generated {new Date().toLocaleString()}</div>
            <hr className="div" style={{ margin: "14px 0" }} />
            <div className="micro" style={{ marginBottom: 4 }}>Documents processed</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Icon name="badge" size={12} />
                <span style={{ fontSize: 12.5 }}>whitfield_cv_v6.pdf</span>
                <span className="micro" style={{ marginLeft: "auto" }}>4 pp</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Icon name="external" size={12} />
                <span style={{ fontSize: 12.5 }}>linkedin_export.txt</span>
                <span className="micro" style={{ marginLeft: "auto" }}>6 kb</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Icon name="badge" size={12} />
                <span style={{ fontSize: 12.5 }}>career_direction.md</span>
                <span className="micro" style={{ marginLeft: "auto" }}>2 kb</span>
              </div>
            </div>
          </div>

          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Pushed to Juno brain</div>
            <div className="body" style={{ fontSize: 12.5 }}>
              Profile summary, top 8 skills, and target role were appended to your workspace knowledge base on{" "}
              <span style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>May 11</span>.
            </div>
            <button className="btn ghost sm" style={{ marginTop: 10, padding: "4px 0" }}>
              View brain entries <Icon name="external" size={12} />
            </button>
          </div>

          <div className="card padded">
            <div className="eyebrow" style={{ marginBottom: 10 }}>Next</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="row-link" style={{ padding: 12 }} onClick={() => navigate("/careeros/skills")}>
                <div className="icon-tile" style={{ width: 28, height: 28 }}><Icon name="brain" size={14} /></div>
                <div className="copy"><div className="title" style={{ fontSize: 13 }}>Open skill portfolio</div></div>
                <Icon name="chevron_right" size={14} className="chev" />
              </button>
              <button className="row-link" style={{ padding: 12 }} onClick={() => navigate("/careeros/health-report")}>
                <div className="icon-tile" style={{ width: 28, height: 28 }}><Icon name="heart" size={14} /></div>
                <div className="copy"><div className="title" style={{ fontSize: 13 }}>View Career Health Report</div></div>
                <Icon name="chevron_right" size={14} className="chev" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.CareerOSHome = CareerOSHome;
