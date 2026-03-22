# Agentic architecture — Juno as executive team (Inngest backbone)

## Mental model (Zazu)

| Old framing | New framing |
|-------------|-------------|
| Chatbot that answers when asked | **Autonomous executives** that wake on a schedule or event, do work, and **report back** |
| Single request/response | **Durable workflows**: steps, retries, fan-out, waits |
| “User types, model replies” | **Orchestration**: collect context → run tools → persist → notify |

**Inngest** is the reliability layer: **cron**, **events**, **multi-step functions**, **retries**, **observability**, without you operating a queue cluster.

---

## Current app (baseline)

| Layer | Today |
|-------|--------|
| UI | Dashboard, role pages, floating Juno chat |
| Sync AI | `/api/chat`, `/api/ai-tool`, `/api/delegate`, many `/api/generate-*` |
| Context | `getCompanyContext()` (Supabase profile + assets + Supermemory) |
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

| Function id | Trigger | Role |
|-------------|---------|------|
| `juno-daily-brief` | Cron `0 7 * * *` (example) | Fan-out: for each active user, run curated brief pipeline |
| `juno-exec-run-tool` | Event `juno/tool.run` | Wraps `runTool` with company context |
| `juno-delegate-execute` | Event after delegate | Sequential or parallel `ai-tool` calls |

Start **narrow**: one **cron** that processes **one** job type (e.g. “refresh Today’s Brief candidates”) before full per-user fan-out.

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

3. **Paperclip** — optional step after delegate: POST goal via existing `PAPERCLIP_URL` pattern.

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
