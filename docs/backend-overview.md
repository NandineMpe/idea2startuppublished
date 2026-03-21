# IdeaToStartup — Backend Overview

This document describes **server-side and data-layer** pieces of the app: middleware, authentication, database schema, HTTP APIs, shared server libraries, and external integrations.

The app is a **Next.js App Router** project. “Backend” here means **Route Handlers** under `app/api/`, **auth routes**, **middleware**, **`lib/`** server utilities, and **Supabase** (PostgreSQL + Auth).

---

## 1. Architecture at a glance

| Layer | Technology |
|--------|------------|
| Runtime | Node.js (Next.js server / Route Handlers) |
| Auth | **Supabase Auth** (sessions via cookies; OAuth code exchange in `app/auth/callback`) |
| Primary database | **Supabase (PostgreSQL)** with Row Level Security (RLS) |
| Semantic memory | **Supermemory** (HTTP API: memorize + search), namespaced per user |
| Primary LLM | **Anthropic Claude** via **Vercel AI SDK** (`@ai-sdk/anthropic`, model `claude-sonnet-4-20250514`) |
| Optional org layer | **Paperclip** HTTP service (reverse-proxied); delegation also calls Paperclip APIs when configured |
| Search (founder research) | **Exa** (`lib/exa.ts`) |
| Document text | **pdf-parse** for PDFs in company asset uploads |

---

## 2. Middleware

**File:** `middleware.ts`  

- Invokes **`updateSession`** from `lib/supabase/middleware.ts` on most routes (excludes static assets via `matcher`).
- Refreshes Supabase session cookies on the edge of each request.
- **Redirects unauthenticated users** from `/dashboard/*` to `/login` (paths `/login` and `/auth/*` are allowed without a user).

---

## 3. Authentication

| Piece | Role |
|--------|------|
| `lib/supabase/server.ts` | Server Supabase client using cookies (`@supabase/ssr`). |
| `lib/supabase/middleware.ts` | Edge Supabase client for session refresh in middleware. |
| `lib/supabase/client.ts` | Browser client (not “backend,” but paired with server). |
| `app/auth/callback/route.ts` | **GET** — OAuth `code` exchange via `exchangeCodeForSession`, then redirect to `next` or `/dashboard`. |

**Note:** `lib/supabase.ts` exposes `supabaseAdmin` (service role). Intended for trusted server-only use; ensure `SUPABASE_SERVICE_ROLE_KEY` is set where used.

---

## 4. Database (Supabase / PostgreSQL)

Migrations live in **`supabase/migrations/`**. Run in order in the Supabase SQL Editor.

### 4.1 `001_initial_schema.sql`

| Table | Purpose |
|--------|---------|
| **`chat_sessions`** | Juno chat threads: `user_id`, `title`, timestamps. |
| **`chat_messages`** | Messages: `session_id`, `user_id`, `role` (`user` \| `assistant`), `content`. |
| **`ai_outputs`** | Saved AI tool outputs: `tool`, `title`, `inputs` (JSONB), `output`, timestamps. |
| **`user_feedback`** | Feedback items: `source`, `sentiment`, `content`, `tags[]`. |

**RLS:** All four tables restrict rows to `auth.uid() = user_id` (feedback allows nullable `user_id` on insert in app logic).

**Helpers:** `update_updated_at()` trigger function; triggers on `chat_sessions` and `ai_outputs`; `company_profile` trigger added in `002`.

### 4.2 `002_company_profile.sql`

| Table | Purpose |
|--------|---------|
| **`company_profile`** | One row per user: company fields (`company_name`, `tagline`, `problem`, `solution`, `target_market`, `industry`, `stage`, `traction`, `team_summary`, `funding_goal`). |
| **`company_assets`** | `type`: `pitch_deck` \| `document` \| `scraped_url`; `title`, `source_url`, `content`, optional `storage_path`. |

### 4.3 `003_founder_profile.sql`

Adds to **`company_profile`:** `founder_name`, `founder_location`, `founder_background`.

---

## 5. HTTP API — Route Handlers (`app/api/`)

Below: **method(s)** and **primary behavior**. Unless noted, routes use Supabase server client for auth and persistence.

### 5.1 Chat & memory

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/chat`** | POST | Juno chat: loads Supermemory context, **company context**, calls **Claude** (`generateText`), saves messages to `chat_messages` / updates session when `sessionId` + user present. |
| **`/api/chat/deepseek`** | POST | Alternate chat entry (still uses Anthropic in code; name is legacy). |
| **`/api/chat/sessions`** | GET, POST | List sessions (newest first); create session. |
| **`/api/chat/sessions/[id]`** | GET, DELETE | Load messages for session; delete session (cascades messages via FK). |

### 5.2 Company knowledge

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/company/profile`** | GET, PUT | Read/update `company_profile` (including founder fields after migration 003). |
| **`/api/company/assets`** | GET, POST | List assets; upload file → extract text (PDF via **pdf-parse**, text types as UTF-8), store in `company_assets`, optional Supermemory sync. |
| **`/api/company/scrape`** | POST | `fetch` URL + **html-to-text**, save as `scraped_url` asset, trim content, fire-and-forget Supermemory. |
| **`/api/company/context`** | GET | Returns aggregated string from **`getCompanyContext(userId)`** (profile + assets + Supermemory). |
| **`/api/save-knowledge`** | POST | JSON body → **`addToMemory`** (Supermemory) with optional `userId`. |

### 5.3 Unified AI tool execution

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/ai-tool`** | POST | Runs a named tool from **`lib/ai-tools.ts`** (`runTool`) with **company context**; persists to **`ai_outputs`** when user logged in. Requires **`ANTHROPIC_API_KEY`**. |

### 5.4 Delegation (Command Center → agents)

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/delegate`** | POST | Strategic goal → Claude plan (tasks per agent/tool); optional **Paperclip** goal creation via HTTP to `PAPERCLIP_URL`. |

### 5.5 Paperclip proxy

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/paperclip/[...path]`** | GET, POST, PATCH, PUT, DELETE | Proxies to **`PAPERCLIP_URL`** (default `http://localhost:3100`), path rewritten from `/api/paperclip` → Paperclip `/api/...`. |

### 5.6 Feedback

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/feedback`** | GET, POST, DELETE | CRUD-style on **`user_feedback`** (list, create, delete by id). |

### 5.7 User profile (stub)

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/user/profile`** | GET | Returns **static** JSON (placeholder user); not tied to Supabase `auth.users`. |

### 5.8 Idea analysis & generation (representative)

These routes typically: validate input, **`getCompanyContext`** when user present, call **Claude** via `@ai-sdk/anthropic` + `generateText` / streaming patterns, and may persist or return JSON.

| Route | Purpose (high level) |
|--------|----------------------|
| **`/api/openai-idea-analysis`** | Idea analysis (uses Anthropic in implementation). |
| **`/api/gemini-idea-analysis`** | Idea analysis (uses Anthropic in implementation). |
| **`/api/analyze-market-simple`** | Market / consumer insights from a query. |
| **`/api/research-founder`** | Founder research; may use **Exa** (`searchFounder`). |
| **`/api/idea-to-product/competitor-analysis`** | Competitor analysis (incl. Perplexity-named file; check route for exact stack). |
| **`/api/generate-business-model`** | Business model generation. |
| **`/api/generate-value-proposition`** | Value proposition. |
| **`/api/generate-roadmap`** | Roadmap. |
| **`/api/generate-investor-pitch`** | Investor pitch. |
| **`/api/generate-customer-pitch`** | Customer pitch. |
| **`/api/generate-networking-pitch`** | Networking pitch. |
| **`/api/generate-founder-story`** | Founder story. |
| **`/api/generate-pitch-slide`** | Pitch slide content. |

### 5.9 Health / test

| Route | Methods | Description |
|--------|---------|-------------|
| **`/api/test`** | GET | Simple JSON `{ message, timestamp }` health check. |

---

## 6. Server libraries (`lib/`)

| Module | Role |
|--------|------|
| **`company-context.ts`** | **`getCompanyContext(userId)`** — builds text from `company_profile`, `company_assets` (pitch deck + docs/scrapes), **Supermemory** search. Used by chat, delegate, ai-tool, and many generate routes. |
| **`ai-tools.ts`** | Registry of agent **tools** (`TOOLS`), **`runTool`**, prompts; uses **Anthropic** Claude. |
| **`supermemory.ts`** | **`addToMemory`**, **`queryMemory`** — Supermemory HTTP API with `containerTags: user:<userId>`. |
| **`exa.ts`** | **`searchFounder`** — Exa neural search for founder-linked content. |
| **`paperclip.ts`** | Types/helpers for Paperclip integration (used with proxy + delegate). |
| **`get-user.ts`** | Helpers to resolve user (if present). |
| **`database.ts`** | Legacy-style user helpers (**bcrypt**, etc.); **not imported** by current `app/` API routes — treat as optional/legacy unless you wire it in. |

---

## 7. Environment variables (backend-relevant)

Set these in **Vercel** / **`.env.local`** as appropriate. Do **not** commit secrets.

| Variable | Used for |
|----------|-----------|
| **`NEXT_PUBLIC_SUPABASE_URL`** | Supabase project URL. |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Supabase anon key (browser + server SSR). |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Admin client (`lib/supabase.ts`); bypasses RLS — server-only. |
| **`ANTHROPIC_API_KEY`** | Claude across chat, tools, delegate, generation routes. |
| **`SUPERMEMORY_API_KEY`** | Supermemory memorize/search. |
| **`EXA_API_KEY`** | Exa search (`lib/exa.ts`). |
| **`PAPERCLIP_URL`** | Paperclip service base URL (delegate + proxy). |

**Security note:** `lib/supabase/server.ts` and middleware currently include **fallback** URL/key strings if env vars are missing. Production should rely on **env-only** values and rotate any keys that were ever committed.

---

## 8. What is *not* in the backend yet

- **Today’s Brief** feed: UI wireframe only; no `feed_items` table or cron in this repo as of this document.
- **`/api/user/profile`**: not synced with Supabase Auth profiles.
- **Clerk** (mentioned in older README): app flow described here uses **Supabase Auth** + middleware.

---

## 9. Document maintenance

When you add a new **`app/api/.../route.ts`** or migration, update this file or add a short pointer in **`docs/README.md`** so the backend map stays accurate.

*Last aligned with repo layout: snapshot of `app/api` route files and `supabase/migrations`.*
