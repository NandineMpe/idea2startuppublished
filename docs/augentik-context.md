# Augentik — Juno context

*Brief for agents and new team members. Replaces the previous Corgi-labeled draft in this workspace.*

---

## What we are building

Augentik is the first full-stack, AI-native insurance carrier built for technology startups. Not a broker. Not an MGA. We own underwriting, pricing, policy administration, claims, and reinsurance end to end.

Founders get a full quote and a bound certificate in under 10 minutes. Traditional paths take 3–6 weeks, 8–12 human touchpoints, and legacy stacks built for corporate risk managers, not founders closing rounds or signing enterprise contracts.

Coverage includes Commercial General Liability, D&O, Tech E&O, Cyber, EPLI, Media Liability, AI Liability (category we pioneered), Hired & Non-Owned Auto, Fiduciary Liability, and Reps & Warranties. Modular and toggleable. No broker in the middle.

Tagline we use: **Business insurance at the speed of compute.**

---

## Problem

Startups move faster than the industry was built to serve. Funding, enterprise contracts, and hiring create insurance triggers on days, not quarters. The old model adds margin and delay at every handoff.

---

## Who buys

**ICP:** Venture-backed technology startups, pre-seed through Series B+, United States (49 states).

**By stage (illustrative bands):**

- Pre-seed / seed: CGL, D&O, Tech E&O, Cyber for hiring, leases, baseline compliance ($2k–$5k/year range).
- Series A: Board-ready D&O, expanded cyber and E&O, media, EPLI ($5k–$15k/year range).
- Series B+: Full stack, fiduciary, complex enterprise certificate needs.

**Triggers:** New round, first enterprise contract, first hires, lease signing, investor or counterparty asking for proof of coverage.

**Not our focus:** Non-tech SMBs, buyers who want a traditional broker relationship first, pure price shopping with no care for speed or clarity.

---

## Competitors (how we talk about them)

- **Vouch:** Closest comp; moving toward carrier depth; we compete on speed and AI-native underwriting.
- **Embroker:** Strong UX; broker model limits control of underwriting and iteration speed.
- **Founder Shield:** Relationship-led broker; we win on automation and time to bind.
- **Koop:** Narrower set, earlier stage.
- **Incumbent carriers (Hiscox, Markel, etc.):** Slow, relationship-heavy; we replace that path for tech-native buyers.

**We win on:** Speed (minutes vs weeks), full carrier stack, modular coverage, founder-first UX, AI Liability, owning risk and float.

**We still invest in:** Human client success for accounts that want a named partner alongside the product.

---

## Business model

Licensed carrier: we collect premium, own risk, earn underwriting profit and float income. We control pricing and product, not a third-party paper.

Average customer roughly ~$1k/year premium (varies by stage and coverage). Revenue is premium plus disciplined investment income on float.

---

## Traction (update when your internal numbers change)

Illustrative snapshot aligned to current strategy narrative:

- 40,000+ active customers (U.S., multi-state).
- $40M+ ARR as of December 2025.
- Full carrier license: July 2025 (confirm date internally).
- Captive reinsurer: late 2025.
- Under 1% annual churn (key retention signal).
- $108M raised at $630M valuation, January 2026 Series B (confirm with legal/IR).

---

## Strategic priorities (next ~90 days)

1. **Productionize the AI underwriting feedback loop.** Quote in minutes is not enough alone. Instrument quote → bind → claim → root cause → model and rules retraining. Track bind rate on quotes, post-bind declinations, and data mismatch so unit economics stay honest.

2. **Defend unit economics.** Harden risk controls and remove friction that leaks revenue. Every point of bind-rate and loss-ratio matters at scale.

3. **GTM at scale.** Partnerships with YC, a16z, Sequoia, and similar firms to reach portfolio companies systematically.

4. **Enterprise readiness.** Capacity for Series B+ accounts that want account management next to a digital core.

---

## Risks

- **Regulatory surface across states:** One serious dispute in a large state can slow distribution.
- **Reinsurance and capital markets:** Hard markets compress margin even for a captive strategy.
- **Underwriting and classification error:** Mispriced segments or bind-then-decline from bad data erode trust and economics. Mitigation is telemetry above, not heroics in spreadsheets.
- **Talent:** Rare mix of insurance regulation depth and modern product engineering.
- **Brand outside core founder networks:** Deliberate GTM required beyond early adopter clusters.

---

## Founding team

**Nico Laqua — CEO & CTO**  
Columbia, Rabi Scholar. Before Augentik: founded Basket (gaming publisher, 200M+ MAU scale). Forbes 30 Under 30 (2024). AI/VR work 2018–2020. Computational biology with Hamilton Smith on complex systems thinking applied to financial risk.

**Emily Yuan — Co-founder & COO**  
Stanford CS. Built with Nico at Basket. Runs operations and GTM.

**Team scale:** ~70, offices SF (HQ), Salt Lake City, Dallas, Chicago, Atlanta.

---

## Thesis — why this, why now

The U.S. P&C stack for SMB and growth-stage tech is still mostly 1970s plumbing plus human relay. Licensing is the real moat; we invested in licenses so we could rebuild the stack instead of wallpapering legacy.

AI changes unit economics: work that took weeks of analyst time can run in seconds when the stack is native, not bolted on. Cloud-native startups are the fastest-growing segment and the worst fit for paper-first carriers.

---

## Voice

**On-brand:** Direct, technical when it helps, “at the speed of compute,” full-stack, we own the risk, built for founders.

**Off-brand:** “Comprehensive solutions,” vague “peace of mind,” “trusted partner,” “industry-leading” without a number.

**One sentence:** Augentik is an AI-native, full-stack insurance carrier for tech startups: quote to bound in minutes, no broker in the middle.

---

## Keywords to monitor

startup insurance, insurtech, tech startup insurance, D&O for startups, cyber insurance startups, AI liability insurance, full-stack insurance carrier, AI underwriting, venture-backed startup insurance, Vouch, Embroker, Founder Shield, captive reinsurance, GAAP insurance revenue, bind rate, loss ratio, quote-to-bind telemetry

---

## Load into Juno (Augentik Team workspace)

1. In the sidebar, select **Augentik Team** so saves hit `client_workspace_profiles`, not your personal org.
2. **Knowledge Base Document:** paste this full markdown file into the textarea, then **Save**.
3. **Structured profile:** open `docs/augentik-profile-payload.json`, copy the JSON object, then in the browser console on `/dashboard/context` run:

```javascript
fetch("/api/company/profile", {
  method: "PUT",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(/* paste the JSON object from augentik-profile-payload.json here */),
}).then((r) => r.json()).then(console.log).catch(console.error)
```

4. Refresh the page. The Company Profile section should show **Augentik**, not Corgi.

If anything still shows Corgi, you were on the wrong workspace or an old **knowledge_base_md** row; use **Erase saved document** or replace the markdown, then **Save** again.
