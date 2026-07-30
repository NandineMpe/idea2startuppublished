/* Shared mock data — populated state for Eleanor Whitfield.
   3 PQE privacy/data protection associate at Bird & Bird London, pivoting
   into AI governance. EU AI Act high-risk obligations apply Aug 2, 2026 —
   roughly 10 weeks out from "today" (May 20, 2026). That deadline is the
   forcing function for hiring and shows up across feed, market, and report. */

const PROFILE = {
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
  headline: "3 PQE privacy & data protection associate at Bird & Bird, charting the move into a dedicated AI governance counsel role within nine to eighteen months.",
  joined: "Joined Mar 2026",
};

const PAST_ROLES = [
  { title: "Associate, Privacy & Data Protection", company: "Bird & Bird LLP", start_date: "Sep 2023", end_date: "Present", note: "Runs UK GDPR and EU AI Act matters under partner supervision; supervises trainees on workstreams." },
  { title: "Trainee Solicitor (4 seats)",            company: "Bird & Bird LLP", start_date: "Sep 2021", end_date: "Aug 2023", note: "Commercial & Tech → IP → Privacy & Data Protection → 6-month Düsseldorf secondment (German Privacy & Tech)." },
  { title: "Summer Vacation Scheme",                  company: "Bird & Bird LLP", start_date: "Jul 2019", end_date: "Aug 2019", note: "Privacy & Commercial groups. Training contract offered and accepted at the close of the scheme." },
  { title: "Student Adviser",                          company: "King's Legal Clinic", start_date: "Sep 2018", end_date: "Jun 2020", note: "Initial advice to low-income clients on employment, housing, and consumer matters under qualified supervision." },
];

const EDUCATION = [
  { institution: "The University of Law, Moorgate", degree: "LPC", field: "Legal Practice Course — Distinction", years: "2020 – 2021" },
  { institution: "King's College London",            degree: "LLB (Hons)", field: "Law — 2:1; dissertation on GDPR Art. 17 and algorithmic erasure", years: "2017 – 2020" },
  { institution: "Camden School for Girls",          degree: "A-Levels", field: "A*AA — Law, History, English Literature", years: "2015 – 2017" },
];

const ACHIEVEMENTS = [
  "Admitted to the Roll of Solicitors of the Senior Courts of England & Wales (Sep 2023). Current Practising Certificate held; subject to SRA continuing competence regime.",
  "Lead associate advising a Series B AI infrastructure company on EU AI Act application — Article 6 high-risk classification, Annex III mapping, and conformity assessment workflow design ahead of the August 2026 obligations.",
  "Co-authored ‘Mapping the EU AI Act onto Existing GDPR Compliance Programmes’ — Privacy Laws & Business UK Report, Issue 137, March 2025.",
  "Co-authored a DPIA template and AI-system governance playbook for a healthcare client, since adopted as their enterprise standard for clinical decision-support deployments.",
  "Panellist — SCL AI Group Junior Lawyers Panel, ‘Where Privacy Practice Ends and AI Governance Begins’ (October 2025).",
];

/* Skills — privacy-law anchored, AI-governance compounding.
   Clusters reflect a lawyer pivoting: Privacy Law (anchor), AI Governance
   (target), Tech Transactions + Regulatory (supporting), Bridge (technical
   literacy), and a couple of legacy items decaying as she sheds them. */
const SKILLS = [
  { name: "UK GDPR & DPA 2018",                cluster: "Privacy Law",      source: "resume",   level: 92, status: "stable",   halflife: 38, exposure: 18, trend: [88,89,90,90,91,91,91,92,92,92], salary_lift: "+12%" },
  { name: "EU GDPR",                            cluster: "Privacy Law",      source: "resume",   level: 90, status: "stable",   halflife: 36, exposure: 20, trend: [88,88,89,89,90,90,90,90,90,90], salary_lift: "+10%" },
  { name: "International Data Transfers",       cluster: "Privacy Law",      source: "resume",   level: 86, status: "stable",   halflife: 28, exposure: 22, trend: [82,83,84,85,85,85,86,86,86,86], salary_lift: "+8%"  },
  { name: "DPIA Design & Review",               cluster: "Privacy Law",      source: "resume",   level: 88, status: "rising",   halflife: 34, exposure: 22, trend: [80,82,83,84,85,86,87,87,88,88], salary_lift: "+11%" },
  { name: "EU AI Act",                          cluster: "AI Governance",    source: "resume",   level: 78, status: "rising",   halflife: 44, exposure: 10, trend: [38,44,50,56,62,68,72,75,77,78], salary_lift: "+28%" },
  { name: "AI Risk Classification (Annex III)", cluster: "AI Governance",    source: "resume",   level: 72, status: "rising",   halflife: 40, exposure: 12, trend: [30,36,42,48,54,60,64,68,70,72], salary_lift: "+24%" },
  { name: "Conformity Assessment Design",       cluster: "AI Governance",    source: "linkedin", level: 64, status: "rising",   halflife: 36, exposure: 14, trend: [22,28,34,40,46,52,56,60,62,64], salary_lift: "+22%" },
  { name: "ISO/IEC 42001",                      cluster: "AI Governance",    source: "linkedin", level: 56, status: "rising",   halflife: 42, exposure: 8,  trend: [12,18,24,30,36,42,48,52,55,56], salary_lift: "+21%" },
  { name: "NIST AI RMF",                        cluster: "AI Governance",    source: "linkedin", level: 60, status: "rising",   halflife: 36, exposure: 10, trend: [22,28,34,40,46,52,55,58,60,60], salary_lift: "+19%" },
  { name: "ICO Investigations & Enforcement",   cluster: "Regulatory",       source: "resume",   level: 76, status: "stable",   halflife: 34, exposure: 18, trend: [74,75,75,76,76,76,76,76,76,76], salary_lift: "+9%"  },
  { name: "DPA / Tech Transactions Drafting",   cluster: "Tech Transactions",source: "resume",   level: 80, status: "stable",   halflife: 30, exposure: 28, trend: [78,79,80,80,80,80,80,80,80,80], salary_lift: "+6%"  },
  { name: "ePrivacy / PECR",                    cluster: "Privacy Law",      source: "resume",   level: 72, status: "declining",halflife: 22, exposure: 38, trend: [78,77,76,75,74,73,72,72,72,72], salary_lift: "+2%"  },
  { name: "Subject Access Requests",            cluster: "Privacy Law",      source: "linkedin", level: 68, status: "at-risk",  halflife: 18, exposure: 64, trend: [78,76,74,72,71,70,69,68,68,68], salary_lift: "0%"   },
  { name: "AI / ML Technical Literacy",         cluster: "Bridge",           source: "linkedin", level: 42, status: "rising",   halflife: 38, exposure: 6,  trend: [6,10,16,22,28,32,36,40,42,42],   salary_lift: "+18%" },
];

/* Feed — clustered by skill it affects. All sources realistic for May 2026.
   The EU AI Act August 2 enforcement deadline is the dominant story. */
const FEED = [
  {
    cluster: "EU AI Act",
    relevance: 0.97,
    why: "9 weeks until Aug 2026 high-risk obligations — your most leveraged skill this quarter",
    items: [
      { source: "EU AI Office", kind: "Guidance", time: "4h", title: "Draft delegated act narrows Article 6(2) safety-component scope; comment window closes 11 June", take: "Reads narrower than the August text most clients are planning against. Worth a one-pager for the Series B AI infra client — their Annex III map may move.", read_mins: 8 },
      { source: "Anthropic Policy", kind: "Blog", time: "Yesterday", title: "Publishing the system-card template Anthropic submits for high-risk classification reviews", take: "First public look at a frontier-lab AI Act conformity submission. Lift the format into your client playbook — it's better than the IAPP draft.", read_mins: 11 },
      { source: "Stanford HAI", kind: "Brief", time: "2d", title: "Member-state divergence in AI Act implementation: where Germany, France, and Ireland disagree", take: "Three different national supervisory authorities, three different views on Annex III thresholds. Affects every cross-border client roll-out you advise on.", read_mins: 14 },
      { source: "Bird & Bird (internal)", kind: "Briefing", time: "3d", title: "August 2026 readiness — partner-led readout of where our top-20 clients sit on conformity", take: "Internal. Mentions your healthcare DPIA template by name. Worth re-reading before the next IAPP panel.", read_mins: 6 },
    ],
  },
  {
    cluster: "AI Risk Classification & Governance Frameworks",
    relevance: 0.93,
    why: "fastest-growing cluster in your portfolio (+24 pts in 90d) and load-bearing for target roles",
    items: [
      { source: "ISO/BSI", kind: "Standards Update", time: "1d", title: "ISO/IEC 42001 — first wave of certified AI Management Systems published; six UK organisations", take: "Two of them are clients. Useful credibility marker for your Lead Implementer in-progress status.", read_mins: 5 },
      { source: "NIST", kind: "Framework", time: "2d", title: "NIST AI RMF Generative AI Profile — v1.1 draft for public comment", take: "The diff against v1.0 mostly tightens evaluation guidance. Map onto your existing client gap analyses before the next intake.", read_mins: 9 },
      { source: "OpenAI", kind: "Policy Release", time: "5d", title: "Preparedness Framework v3 — adds a 'cybersecurity uplift' tracked category and a new Critical threshold", take: "More useful as a comparator for the Anthropic RSP than as guidance for clients. Read for context, not for cite-ability.", read_mins: 12 },
    ],
  },
  {
    cluster: "UK GDPR & ICO",
    relevance: 0.86,
    why: "your anchor practice — declining weight in the pivot but still load-bearing today",
    items: [
      { source: "ICO", kind: "Guidance", time: "6h", title: "ICO refreshes its AI and Data Protection guidance — third update since the Data (Use and Access) Act 2025", take: "Most of the substantive change is on automated decision-making under DUAA s.50. The DPIA-for-AI annex is now non-optional language.", read_mins: 10 },
      { source: "ICO", kind: "Enforcement", time: "2d", title: "£8.5m monetary penalty against a UK retailer for inadequate ML-driven personalisation safeguards", take: "First major enforcement under the post-DUAA framework explicitly citing AI-system governance failures. Bookmark — you'll cite this for years.", read_mins: 7 },
      { source: "IAPP", kind: "Article", time: "3d", title: "Why DPOs are quietly being retitled 'AI & Data Protection Lead' — survey of 240 UK in-house counsel", take: "Your target role description is now appearing in the wild under three different names. Adjust your saved searches.", read_mins: 6 },
    ],
  },
  {
    cluster: "AI Safety & Frontier-Lab Policy",
    relevance: 0.74,
    why: "adjacent to your top target role (in-house counsel at a frontier lab)",
    items: [
      { source: "UK AI Security Institute", kind: "Evaluation Report", time: "1d", title: "Pre-deployment evaluation of Claude 4.5 Opus — cybersecurity and autonomy capability findings", take: "AISI's first jointly-published evaluation with the lab. The methodology section is the read; the findings are summarised in the press release.", read_mins: 18 },
      { source: "GovAI", kind: "Working Paper", time: "4d", title: "‘Whose AI is it anyway?’ — governance allocation between in-house counsel and Responsible AI teams", take: "Maps directly onto the three target shapes you've written down. The 'embedded counsel' model is the one Anthropic uses.", read_mins: 22 },
      { source: "Ada Lovelace Institute", kind: "Report", time: "1w", title: "Public-sector algorithmic transparency — three years of the ATRS in practice", take: "Most relevant for the DSIT target shape. Mentions the CDDO standard you already work to.", read_mins: 16 },
    ],
  },
  {
    cluster: "International Data Transfers",
    relevance: 0.48,
    why: "supporting practice — muted unless a Schrems-class signal moves",
    items: [
      { source: "European Commission", kind: "Adequacy", time: "2d", title: "Adequacy decision for Brazil's LGPD enters force; first South American adequacy", take: "Light-touch for you — your current matters are EU/UK/US dominated. Worth knowing for the FTSE 250 client's next expansion.", read_mins: 4 },
    ],
  },
];

/* Market intel — London-anchored, GBP, target role = AI Governance Counsel.
   Demand has been climbing all year on the back of the Aug 2026 deadline. */
const MARKET = {
  role_title: "AI Governance Counsel",
  current_role_title: "Associate, Privacy & Data Protection (3 PQE)",
  currency: "£",
  demand_index: 168,
  demand_change_90d: 22,
  postings_now: 312,
  postings_quarter_ago: 256,
  deadline_note: "EU AI Act high-risk obligations apply 2 August 2026 — 73 days away",
  salary: {
    /* In-house / advisory AI governance counsel band, London market */
    p25: 165000, p50: 198000, p75: 235000, p90: 290000,
    user_band: { p25: 110000, p50: 125000, p75: 140000 },
  },
  geo: [
    { city: "London",              count: 168, share: 54, p50: 205000 },
    { city: "Remote (UK/EU)",      count:  56, share: 18, p50: 178000 },
    { city: "Dublin",              count:  24, share:  8, p50: 165000 },
    { city: "Brussels",            count:  20, share:  6, p50: 158000 },
    { city: "Cambridge / Oxford",  count:  16, share:  5, p50: 145000 },
    { city: "New York / SF (UK-counsel)", count: 18, share: 6, p50: 245000 },
    { city: "Other",               count:  10, share:  3, p50: 142000 },
  ],
  demand_series: [88, 96, 102, 110, 118, 128, 138, 146, 154, 160, 164, 168],
  adjacent: [
    {
      role: "Responsible AI / In-house Counsel — Frontier Lab",
      fit: 0.84,
      gap: 3,
      lift: "+58%",
      bridge: ["AI / ML Technical Literacy", "Algorithmic Auditing", "NIST AI RMF"],
      notes: "Your top preference. Anthropic, Google DeepMind, OpenAI all have UK counsel openings or near-openings. Bridge is real (technical literacy), but two of three skills are already rising.",
    },
    {
      role: "AI Governance Lawyer — DSIT / AISI / ICO",
      fit: 0.79,
      gap: 2,
      lift: "-32%",
      bridge: ["Public-Sector Procurement", "Algorithmic Transparency Standard"],
      notes: "UK public-sector pay (£85–110k), but the policy-shaping work is the closest fit to your declared preference. Bridge is small.",
    },
    {
      role: "Director, AI Governance Advisory — Big Four",
      fit: 0.72,
      gap: 4,
      lift: "+24%",
      bridge: ["Programme Delivery", "Client-Side Engagement Model", "AI Audit Methodology", "Sales Origination"],
      notes: "PwC, Deloitte, KPMG, EY all building AI risk practices fast. Higher comp, broader portfolio, less depth. Bridge is more about firm-type than skill-type.",
    },
    {
      role: "Senior Counsel — AI-Deploying Financial Services",
      fit: 0.74,
      gap: 3,
      lift: "+34%",
      bridge: ["Financial Services Regulatory", "Vendor Risk", "Model Risk Management"],
      notes: "FS in-house teams are aggressively building AI governance functions for SS1/23 model risk + AI Act dual compliance. Stable, well-paid, less mission-aligned.",
    },
  ],
};

/* Career Health — 5 pillars aligned to a lawyer mid-pivot. */
const HEALTH = {
  generated: "Generated 18 May 2026 · refreshes quarterly",
  overall: 80,
  delta: 6,
  narrative_intro: "You're 3 PQE with the rarer privacy-plus-AI-Act portfolio that hiring managers will pay for. The EU AI Act's high-risk obligations crystallise on 2 August 2026 — that's nine and a half weeks out — which is also a natural runway to land your next move. The portfolio shows the pivot is realistic; your AI cluster is the fastest-rising in your dataset, and your matter list is already shaped like an AI governance practice. The risk is the inverse: your private-practice DNA still skews toward drafting and advisory, where the frontier-lab in-house roles want engineering-adjacent, policy-shaped work. Close that, and you have unusually good degrees of freedom.",
  pillars: [
    { id: "skills",     name: "Skills",     score: 82, delta: 11, blurb: "AI cluster compounding ahead of plan; two legacy items decaying." },
    { id: "market",     name: "Market Fit", score: 78, delta:  8, blurb: "AI Governance Counsel demand index up 22% in 90d in your geo." },
    { id: "network",    name: "Network",    score: 70, delta:  3, blurb: "SCL panel + IAPP AIGG attendance lifted; thin on technical AI researchers." },
    { id: "direction",  name: "Direction",  score: 90, delta: 14, blurb: "Three target shapes ranked in writing, portfolio coheres with #1." },
    { id: "resilience", name: "Resilience", score: 78, delta:  2, blurb: "London private-practice salary runway healthy; SRA practising certificate current." },
  ],
};

const DASH_CTX = {
  profileHeadline: PROFILE.headline,
  onboardingComplete: true,
  extractionStatus: "completed",
  showProfileActive: true,
};

Object.assign(window, {
  PROFILE, PAST_ROLES, EDUCATION, ACHIEVEMENTS,
  SKILLS, FEED, MARKET, HEALTH, DASH_CTX,
});
