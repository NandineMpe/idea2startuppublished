/** Demo data from CareerOS prototype (Eleanor Whitfield persona). Used when live intel is thin. */

export const DEMO_PROFILE = {
  name: "Eleanor Whitfield",
  initials: "EW",
  email: "eleanor.whitfield@inbox.eleanor.law",
  current_role_title: "Associate, Privacy & Data Protection",
  current_company: "Bird & Bird LLP",
  years_experience: 3,
  pqe_label: "3 PQE",
  current_salary_gbp: 125000,
  target_role_title: "AI Governance Counsel",
  location_label: "London, UK",
  headline:
    "3 PQE privacy & data protection associate at Bird & Bird, charting the move into a dedicated AI governance counsel role within nine to eighteen months.",
  joined: "Joined Mar 2026",
}

export const DEMO_PAST_ROLES = [
  {
    title: "Associate, Privacy & Data Protection",
    company: "Bird & Bird LLP",
    start_date: "Sep 2023",
    end_date: "Present",
    note: "Runs UK GDPR and EU AI Act matters under partner supervision; supervises trainees on workstreams.",
  },
  {
    title: "Trainee Solicitor (4 seats)",
    company: "Bird & Bird LLP",
    start_date: "Sep 2021",
    end_date: "Aug 2023",
    note: "Commercial & Tech → IP → Privacy & Data Protection → 6-month Düsseldorf secondment.",
  },
  {
    title: "Summer Vacation Scheme",
    company: "Bird & Bird LLP",
    start_date: "Jul 2019",
    end_date: "Aug 2019",
    note: "Privacy & Commercial groups. Training contract offered and accepted.",
  },
  {
    title: "Student Adviser",
    company: "King's Legal Clinic",
    start_date: "Sep 2018",
    end_date: "Jun 2020",
    note: "Initial advice to low-income clients on employment, housing, and consumer matters.",
  },
]

export const DEMO_EDUCATION = [
  {
    institution: "The University of Law, Moorgate",
    degree: "LPC",
    field: "Legal Practice Course — Distinction",
    years: "2020 – 2021",
  },
  {
    institution: "King's College London",
    degree: "LLB (Hons)",
    field: "Law — 2:1",
    years: "2017 – 2020",
  },
  {
    institution: "Camden School for Girls",
    degree: "A-Levels",
    field: "A*AA — Law, History, English Literature",
    years: "2015 – 2017",
  },
]

export const DEMO_ACHIEVEMENTS = [
  "Admitted to the Roll of Solicitors of the Senior Courts of England & Wales (Sep 2023).",
  "Lead associate advising a Series B AI infrastructure company on EU AI Act application.",
  "Co-authored ‘Mapping the EU AI Act onto Existing GDPR Compliance Programmes’ — Privacy Laws & Business UK Report, March 2025.",
  "Co-authored a DPIA template and AI-system governance playbook for a healthcare client.",
  "Panellist — SCL AI Group Junior Lawyers Panel, October 2025.",
]

export type DemoSkill = {
  name: string
  cluster: string
  source: string
  level: number
  status: "rising" | "stable" | "declining" | "at-risk"
  halflife: number
  exposure: number
  trend: number[]
  salary_lift: string
}

export const DEMO_SKILLS: DemoSkill[] = [
  {
    name: "UK GDPR & DPA 2018",
    cluster: "Privacy Law",
    source: "resume",
    level: 92,
    status: "stable",
    halflife: 38,
    exposure: 18,
    trend: [88, 89, 90, 90, 91, 91, 91, 92, 92, 92],
    salary_lift: "+12%",
  },
  {
    name: "EU GDPR",
    cluster: "Privacy Law",
    source: "resume",
    level: 90,
    status: "stable",
    halflife: 36,
    exposure: 20,
    trend: [88, 88, 89, 89, 90, 90, 90, 90, 90, 90],
    salary_lift: "+10%",
  },
  {
    name: "EU AI Act",
    cluster: "AI Governance",
    source: "resume",
    level: 78,
    status: "rising",
    halflife: 44,
    exposure: 10,
    trend: [38, 44, 50, 56, 62, 68, 72, 75, 77, 78],
    salary_lift: "+28%",
  },
  {
    name: "AI Risk Classification (Annex III)",
    cluster: "AI Governance",
    source: "resume",
    level: 72,
    status: "rising",
    halflife: 40,
    exposure: 12,
    trend: [30, 36, 42, 48, 54, 60, 64, 68, 70, 72],
    salary_lift: "+24%",
  },
  {
    name: "ISO/IEC 42001",
    cluster: "AI Governance",
    source: "linkedin",
    level: 56,
    status: "rising",
    halflife: 42,
    exposure: 8,
    trend: [12, 18, 24, 30, 36, 42, 48, 52, 55, 56],
    salary_lift: "+21%",
  },
  {
    name: "DPIA Design & Review",
    cluster: "Privacy Law",
    source: "resume",
    level: 88,
    status: "rising",
    halflife: 34,
    exposure: 22,
    trend: [80, 82, 83, 84, 85, 86, 87, 87, 88, 88],
    salary_lift: "+11%",
  },
  {
    name: "Subject Access Requests",
    cluster: "Privacy Law",
    source: "linkedin",
    level: 68,
    status: "at-risk",
    halflife: 18,
    exposure: 64,
    trend: [78, 76, 74, 72, 71, 70, 69, 68, 68, 68],
    salary_lift: "0%",
  },
]

export const DEMO_FEED = [
  {
    cluster: "EU AI Act",
    relevance: 0.97,
    why: "9 weeks until Aug 2026 high-risk obligations — your most leveraged skill this quarter",
    items: [
      {
        source: "EU AI Office",
        kind: "Guidance",
        time: "4h",
        title:
          "Draft delegated act narrows Article 6(2) safety-component scope; comment window closes 11 June",
        take: "Reads narrower than the August text most clients are planning against.",
        read_mins: 8,
      },
      {
        source: "Anthropic Policy",
        kind: "Blog",
        time: "Yesterday",
        title:
          "Publishing the system-card template Anthropic submits for high-risk classification reviews",
        take: "First public look at a frontier-lab AI Act conformity submission.",
        read_mins: 11,
      },
    ],
  },
  {
    cluster: "AI Risk Classification & Governance Frameworks",
    relevance: 0.93,
    why: "fastest-growing cluster in your portfolio (+24 pts in 90d)",
    items: [
      {
        source: "ISO/BSI",
        kind: "Standards Update",
        time: "1d",
        title: "ISO/IEC 42001 — first wave of certified AI Management Systems published",
        take: "Two of them are clients. Useful credibility marker.",
        read_mins: 5,
      },
    ],
  },
]

export const DEMO_MARKET = {
  role_title: "AI Governance Counsel",
  current_role_title: "Associate, Privacy & Data Protection (3 PQE)",
  currency: "£",
  demand_index: 168,
  demand_change_90d: 22,
  postings_now: 312,
  deadline_note: "EU AI Act high-risk obligations apply 2 August 2026 — 73 days away",
  salary: {
    p25: 165000,
    p50: 198000,
    p75: 235000,
    p90: 290000,
    user_band: { p25: 110000, p50: 125000, p75: 140000 },
  },
  geo: [
    { city: "London", count: 168, share: 54, p50: 205000 },
    { city: "Remote (UK/EU)", count: 56, share: 18, p50: 178000 },
    { city: "Dublin", count: 24, share: 8, p50: 165000 },
  ],
  demand_series: [88, 96, 102, 110, 118, 128, 138, 146, 154, 160, 164, 168],
  adjacent: [
    {
      role: "Responsible AI / In-house Counsel — Frontier Lab",
      fit: 0.84,
      gap: 3,
      lift: "+58%",
      bridge: ["AI / ML Technical Literacy", "Algorithmic Auditing", "NIST AI RMF"],
      notes: "Your top preference. Bridge is real but two of three skills are already rising.",
    },
    {
      role: "AI Governance Lawyer — DSIT / AISI / ICO",
      fit: 0.79,
      gap: 2,
      lift: "-32%",
      bridge: ["Public-Sector Procurement", "Algorithmic Transparency Standard"],
      notes: "UK public-sector pay lower, but policy work fits your declared preference.",
    },
  ],
}

export const DEMO_HEALTH = {
  generated: "Generated 18 May 2026 · refreshes quarterly",
  overall: 80,
  delta: 6,
  narrative_intro:
    "You're 3 PQE with the rarer privacy-plus-AI-Act portfolio that hiring managers will pay for. The EU AI Act's high-risk obligations crystallise on 2 August 2026.",
  pillars: [
    { id: "skills", name: "Skills", score: 82, delta: 11, blurb: "AI cluster compounding ahead of plan." },
    { id: "market", name: "Market Fit", score: 78, delta: 8, blurb: "AI Governance Counsel demand up 22% in 90d." },
    { id: "network", name: "Network", score: 70, delta: 3, blurb: "SCL panel lifted; thin on technical AI researchers." },
    { id: "direction", name: "Direction", score: 90, delta: 14, blurb: "Three target shapes ranked in writing." },
    { id: "resilience", name: "Resilience", score: 78, delta: 2, blurb: "London private-practice salary runway healthy." },
  ],
}

export const JUNO_DASHBOARD_READ =
  "Slaughter and May went firmwide on Harvey on 29 April, the third Magic Circle firm to embed generative legal AI into day-to-day practice. ICO opened consultation on its draft Automated Decision-Making and profiling guidance. ISO/IEC 42001, up 4 points as CEN-CENELEC's AI standards work matures into operational scope. AI Governance Counsel postings in London, up 22% this quarter, with median posted comp tracking 15% above your current band. The EU AI Office's GPAI Signatory Taskforce begins formal coordination ahead of the 2 August enforcement turn."
