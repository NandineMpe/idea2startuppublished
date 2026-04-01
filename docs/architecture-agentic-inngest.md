# Agentic architecture — Juno as executive team (Inngest backbone)

## Mental model (Zazu)

| Old framing | New framing |
|-------------|-------------|
| Chatbot that answers when asked | **Autonomous executives** that wake on a schedule or event, do work, and **report back** |
| Single request/response | **Durable workflows**: steps, retries, fan-out, waits |
| “User types, model replies” | **Orchestration**: collect context → run tools → persist → notify |

**Inngest** is the reliability layer: **cron**, **events**, **multi-step functions**, **retries**, **observability**, without you operating a queue cluster.

---

## Juno vs IdeaToStartup v1 — three principles

These separate **Juno** (autonomous, composable executives) from **v1** (isolated chat + one-off API calls).

### 1. Agents **chain**, not just run

The daily brief is **not a dead end**. When it surfaces something actionable — e.g. *“Profound is hiring a Controller”* — that becomes an **event**, not only a row in a feed.

**Flow (one morning scrape can trigger a full pipeline):**

1. **Daily brief / scrape** finishes parsing → emits **`juno/lead.discovered`** (or domain-specific name) with payload such as `{ userId, company, role, angle, sourceUrl, rawSnippet }`.
2. **CRO** (research) function is triggered by that event → enriches the lead (firmographics, news, angles) → persists + emits **`juno/lead.enriched`** (or the same event with `phase: "enriched"`).
3. **CMO** function listens for **`juno/lead.enriched`** → drafts outreach (email, LinkedIn angle, talk track) → persists to `ai_outputs` / inbox.

**Inngest shape:** inside the brief function, after classifying a high-value item:

```ts
await step.sendEvent("signal-lead", {
  name: "juno/lead.discovered",
  data: { userId, company: "Profound", role: "Controller", angle: "...", sourceUrl: "..." },
})
```

Downstream functions register with `triggers: [{ event: "juno/lead.discovered" }]` (and optionally **`waitForEvent`** / fan-out if you need ordering). Each step is **retryable**, **observable**, and **independent** — swap CMO prompt without touching the brief.

**v1 behavior:** brief would show a line of text; the user would manually ask CRO, then CMO — no shared pipeline, no durability.

### 2. *(To articulate)*

*Reserved for the next principle — e.g. trust / verification, or human-in-the-loop gates.*

### 3. *(To articulate)*

*Reserved — e.g. memory + state across days, or org-wide vs user-scoped runs.*

---

## Current app (baseline)

| Layer | Today |
|-------|--------|
| UI | Dashboard, role pages, floating Juno chat |
| Sync AI | `/api/chat`, `/api/ai-tool`, `/api/delegate`, many `/api/generate-*` |
| Context | `getCompanyContext()` (Supabase profile + assets + Obsidian vault) |
| Org (optional) | Paperclip proxy + delegate creates goals when online |
| Persistence | Supabase: `chat_*`, `ai_outputs`, `company_*`, feedback |

**Gap:** almost everything is **request-scoped**. Nothing “wakes up” for all users at 6am to run the CRO brief unless something calls an API.

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Inngest Cloud (schedules + events + retries)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ invokes
┌────────────────────────────▼────────────────────────────────────┐
│ Next.js Route: POST /api/inngest (Inngest serve handler)        │
│  • Registers all Juno workflow functions                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
     ▼                       ▼                       ▼
┌─────────────┐      ┌─────────────┐        ┌─────────────┐
│ Cron: daily │      │ Event:      │        │ Event:      │
│ brief tick  │      │ user.goal   │        │ agent.step   │
│ (per tier)  │      │ submitted   │        │ completed    │
└─────────────┘      └─────────────┘        └─────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Steps (each is retryable, logged in Inngest UI)                  │
│  1. loadCompanyContext(userId)                                  │
│  2. runTool(...) or generateText(...) — same as today’s APIs    │
│  3. write ai_outputs / new table agent_runs / feed_items         │
│  4. send in-app notification or email (future)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Naming: events & functions

Use a **`juno/`** prefix so dashboards stay readable:

| Event name | Purpose |
|------------|---------|
| `juno/ping` | Health / wiring check |
| `juno/daily.tick` | Global or per-env cron entry (fan-out to users in a step) |
| `juno/user.brief.requested` | User asked for async brief |
| `juno/delegate.plan_ready` | Delegate produced tasks; optional chained execution |
| **`juno/lead.discovered`** | Emitted when brief/scrape surfaces actionable intel (company + role + angle) — **starts CRO → CMO chain** |
| **`juno/lead.enriched`** | CRO finished enrichment; optional trigger for CMO outreach draft |

### Functions

| Function id | Trigger | Role |
|-------------|---------|------|
| `juno-daily-brief` | Cron `0 7 * * *` (example) | Fan-out: for each active user, run curated brief pipeline |
| `juno-exec-run-tool` | Event `juno/tool.run` | Wraps `runTool` with company context |
| `juno-delegate-execute` | Event after delegate | Sequential or parallel `ai-tool` calls |
| `juno-cro-enrich-lead` | `juno/lead.discovered` | Research / enrichment step (competition tool, web, etc.) |
| `juno-cmo-draft-outreach` | `juno/lead.enriched` | GTM copy, sequences, angles |

Start **narrow**: one **cron** that processes **one** job type (e.g. “refresh Today’s Brief candidates”) before full per-user fan-out. Add **`step.sendEvent`** to **`juno/lead.discovered`** only after brief quality is good enough to avoid noise.

---

## Data model additions (phased)

| Table / store | Purpose |
|----------------|---------|
| `agent_runs` (new) | `user_id`, `agent_slug`, `status`, `input`, `output`, `inngest_run_id` |
| `feed_items` (new) | Daily brief rows: headline, url, source, category, `user_id`, `created_at` |
| Existing | `ai_outputs`, `company_profile` — keep using for long-form saves |

RLS: same as today (`user_id` = `auth.uid()`).

---

## Integration with existing code

1. **Do not duplicate prompts** — call shared helpers:
   - `getCompanyContext(userId)`
   - `runTool(toolId, inputs, companyContext)` from `lib/ai-tools.ts`
   - Or internal `fetch` to your own `/api/ai-tool` if you need HTTP parity (usually import is enough).

2. **Auth in background jobs** — Inngest functions are server-side; use **`userId` in event data** (from cron fan-out or DB query). Never trust client-sent userId without session — scheduled jobs load `user_id` from Supabase service role or a signed event payload.

---

## Deployment checklist

| Item | Notes |
|------|--------|
| `INNGEST_EVENT_KEY` | Send events from app (optional) |
| `INNGEST_SIGNING_KEY` | Verify requests to `/api/inngest` |
| Vercel | Env vars; Inngest discovers `serve` URL |
| Local dev | `npx inngest-cli@latest dev` to tunnel and see runs |

---

## SDK note (Inngest v4)

`createFunction` takes **one options object** with `triggers: [{ event: "name" }]` or `[{ cron: "..." }]`, then the **handler** as the second argument. See `lib/inngest/functions.ts`.

## Rollout phases

1. **Scaffold** — `serve` + one `juno/ping` function (done in repo).
2. **Daily brief** — cron → fetch RSS/APIs → insert `feed_items` (or stub) per user.
3. **Delegate execution** — event chain: delegate → enqueue N tool runs → aggregate → Supabase.
4. **Notifications** — email/Slack/push when a run completes.

---

## Summary

You’re moving from **“API routes that run when the user clicks”** to **“Inngest functions that run on time or on events, call the same brain (`getCompanyContext` + tools), and persist results.”** The UI becomes **command + inbox**, not the only execution engine.

**Principle 1 in one line:** the daily brief **emits**; CRO and CMO **subscribe** — **`step.sendEvent`** is the handoff, not a new chat session.
