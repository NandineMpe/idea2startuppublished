# Command Center — Founder Daily Brief (design outline)

## Purpose

A **once-per-day, curated news surface** at the top of the Command Center that answers: *What should this founder know today?* It complements the executive team grid by surfacing **external signal** (AI releases, research, competitors, funding) personalized to the startup’s profile (industry, stage, competitors, geography).

---

## Placement & layout

| Zone | Content |
|------|---------|
| **1 — Header** | Existing title + subtitle (“Command Center” / executive team copy). |
| **2 — Quick stats** | Unchanged 4-card row (agents, tasks, budget, completion). |
| **3 — Two-column row** *(lg+)* | **Left:** Executive Team heading + agent grid. **Right:** **Today’s Brief** in a fixed-width sidebar (`~380px`), **sticky** while scrolling the main column. |
| **Mobile / &lt; lg** | Stack: stats → Executive Team → Today’s Brief (full width below the team). |

**Rationale:** Stats stay full-width. The brief stays visible on the **right** on large screens (like a live ticker / briefing panel) while founders scan the executive grid. On small screens the brief stacks under the team so the layout doesn’t squeeze.

---

## Information architecture (sections)

Stories are grouped into **scannable blocks**. Order is fixed so the feed feels predictable every day:

1. **Breaking** — Time-sensitive items (regulatory, major product launches, market shocks). Pinned or sorted first within the panel.
2. **AI & tools** — Model/product releases that **map to the founder’s context** (e.g. compliance startup → Claude for Excel, ChatGPT for finance). Each item includes a **one-line “why you care”** when we have profile data.
3. **Research** — Papers, benchmarks, datasets (e.g. arXiv finance benchmark). Label source type (arXiv, journal, blog summary).
4. **Competitors** — Product launches, partnerships, hiring signals, “big moves.”
5. **Funding** — Competitor and adjacent-space rounds (amount, stage, investor if known).

Empty states per section: *“Nothing new in this category today”* (not hidden) so trust in “we checked” is visible.

---

## Story card (row) — what each item shows

Each row is **one line + metadata**, easy to skim (not a blog card with huge images in v1).

| Element | Description |
|---------|-------------|
| **Headline** | Short title (max ~2 lines). |
| **Relevance** | Optional subline: *why this matters to you* (from company profile + tags). |
| **Source** | Always visible: publication name, or “arXiv”, “SEC”, etc. |
| **Time** | Relative or date (“Today”, “2h ago”, “Mar 16”). |
| **Category badge** | Matches section (Breaking / AI / Research / Competitor / Funding). |

**Interaction**

- **Double-click** the row → open the canonical URL in a **new tab** (`window.open`, `noopener,noreferrer`).  
- **Single click** (optional v1.1): select/highlight row only; avoids accidental navigation while scrolling on touch devices.  
- **Keyboard:** `Enter` on focused row opens link (accessibility).

---

## Visual hierarchy (easy to follow)

- **Panel title:** `Today’s Brief` + **last updated** timestamp (e.g. “Updated today · 6:00 AM (your timezone)”).
- **Section headers:** Small caps or muted label + optional count (`Breaking · 1`).
- **Density:** Compact list (not cards with heavy padding) so 15–25 items fit without endless scroll; optional “Show more” per section.
- **Breaking:** Subtle emphasis (left border or icon) so it pops without shouting.

---

## Data & daily refresh (future implementation)

- **Inputs:** Company profile + founder profile + explicit “watchlist” (competitors, keywords) + optional RSS/API jobs.  
- **Refresh:** Server-side job (e.g. daily cron) + store `feed_items` per user/org with `published_at`, `url`, `source`, `category`, `summary`, `why_relevant`.  
- **v1 UI:** Static/mock rows to validate layout; then wire API.

---

## Non-goals (v1 outline)

- In-app full article reader (we link out).  
- Real-time tick-by-tick news (daily cadence is enough).  
- Social comments on stories (later).

---

## Summary

**One panel, five sections, compact rows with source + time, double-click to read.** Stats stay full-width; on large screens the brief sits in a **sticky right sidebar** beside the executive team; on mobile it stacks **below** the team.
