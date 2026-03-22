# Juno Debugging Guide — What's Broken and How to Fix It

> You're here because things don't work. This guide assumes nothing.
> Follow it top to bottom. Don't skip steps. Each step tells you
> exactly what to check, what the output should look like, and what
> to do if it's wrong.

**This repo:** Inngest functions are registered via `lib/inngest/functions/index.ts` (which imports flat entry files like `cbs-daily-brief.ts` that re-export implementations under `cbs/`, `cro/`, etc.). Company context lives in **`lib/company-context.ts`** (not under `lib/juno/` — `lib/juno/index.ts` re-exports helpers from there).

---

## Phase 0: Can the app even build?

Before checking Inngest, agents, or Twilio — does the app compile?

### Check 0.1: Does it build locally?

```bash
cd your-project-directory
npm run build
```

**If it fails**: Read the error. The most common problems:

- **Import errors** (`Cannot find module '@/lib/juno/...'`): A file is missing or the import path is wrong. Check that every file from the spec actually exists at the right path.
- **Type errors**: A function signature doesn't match how it's called. Read the error — it tells you the file and line number.
- **Missing packages**: Run `npm install inngest @anthropic-ai/sdk @supabase/supabase-js`

**Do not proceed until `npm run build` succeeds with zero errors.**

### Check 0.2: List every file that should exist

Run this from your project root **(Git Bash / WSL / macOS / Linux)**:

```bash
# These files MUST exist for the agent system to work
echo "=== Checking required files ==="

for f in \
  "lib/inngest/client.ts" \
  "lib/inngest/functions/index.ts" \
  "lib/inngest/functions/cbs-daily-brief.ts" \
  "lib/inngest/functions/cro-lead-pipeline.ts" \
  "lib/inngest/functions/cmo-content-engine.ts" \
  "lib/inngest/functions/cto-tech-radar.ts" \
  "lib/inngest/functions/ping.ts" \
  "lib/company-context.ts" \
  "lib/juno/scrapers.ts" \
  "lib/juno/scoring.ts" \
  "lib/juno/ai-engine.ts" \
  "lib/juno/brief-formatter.ts" \
  "lib/juno/delivery.ts" \
  "lib/juno/index.ts" \
  "app/api/inngest/route.ts" \
  "app/api/juno/trigger-daily-brief/route.ts"
do
  if [ -f "$f" ]; then
    echo "  ✓ $f"
  else
    echo "  ✗ MISSING: $f"
  fi
done
```

**Windows PowerShell (one-liner check):**

```powershell
@(
  "lib/inngest/client.ts","lib/inngest/functions/index.ts","lib/inngest/functions/cbs-daily-brief.ts",
  "lib/inngest/functions/cro-lead-pipeline.ts","lib/inngest/functions/cmo-content-engine.ts",
  "lib/inngest/functions/cto-tech-radar.ts","lib/inngest/functions/ping.ts","lib/company-context.ts",
  "lib/juno/scrapers.ts","lib/juno/scoring.ts","lib/juno/ai-engine.ts","lib/juno/brief-formatter.ts",
  "lib/juno/delivery.ts","lib/juno/index.ts","app/api/inngest/route.ts","app/api/juno/trigger-daily-brief/route.ts"
) | ForEach-Object { if (Test-Path $_) { "  ✓ $_" } else { "  ✗ MISSING: $_" } }
```

**If any file is missing**: That's your problem. The agent system can't work without all files present.

---

## Phase 1: Environment variables

The #1 reason things silently fail. Check EVERY variable.

### Check 1.1: Local env vars

Create or open `.env.local` in your project root. You need ALL of these:

```bash
# Check what you have
cat .env.local
```

**Required variables (app won't function without these):**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  (long JWT, NOT the anon key)
ANTHROPIC_API_KEY=sk-ant-...
```

**How to verify each one:**

```bash
# Test Supabase connection
curl "YOUR_SUPABASE_URL/rest/v1/company_profile?select=id&limit=1" \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

- **If you get JSON back** (even empty array `[]`): Supabase is working
- **If you get 401 or "Invalid API key"**: Wrong key. Go to Supabase > Settings > API and copy the `service_role` key (the second one, not the `anon` key)
- **If you get connection error**: Wrong URL. Check Supabase > Settings > API for the project URL.

```bash
# Test Anthropic key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_ANTHROPIC_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-20250514","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

- **If you get a response with content**: Key works
- **If you get 401**: Wrong key or key is deactivated. Check console.anthropic.com.

### Check 1.2: Vercel env vars

```bash
# If you have Vercel CLI installed:
npx vercel env ls
```

Or go to: **Vercel dashboard > Your project > Settings > Environment Variables**

You need the same vars as local, PLUS:

```
INNGEST_EVENT_KEY     (usually auto-set by Vercel-Inngest integration)
INNGEST_SIGNING_KEY   (usually auto-set by Vercel-Inngest integration)
```

**If INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY are missing**: The Vercel-Inngest integration didn't set them. Go to Vercel > Integrations > Inngest > Configure, and reconnect.

---

## Phase 2: Database

### Check 2.1: Does company_profile have data?

Go to **Supabase > Table Editor > company_profile** or run:

```sql
select user_id, name, description, vertical, keywords, competitors
from company_profile
limit 5;
```

**If empty**: Nothing will work. Every agent starts with `getCompanyContext(userId)` which reads from this table. Go fill in your company profile through the app UI, or insert directly:

```sql
insert into company_profile (user_id, name, description, vertical, keywords, competitors)
values (
  'YOUR_SUPABASE_USER_UUID',
  'Juno.ai',
  'AI executive team for solo founders',
  'AI founder tools',
  '["ai agents", "founder tools", "startup automation", "agentic ai"]',
  '["Lindy.ai", "Relevance AI", "CrewAI"]'
);
```

### Check 2.2: What are the actual column names?

This is a common source of bugs. The code expects certain column names. Check:

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'company_profile'
order by ordinal_position;
```

**Compare the output with what `lib/company-context.ts` expects.**

The code tries variants like `name` vs `company_name`, `description` vs `company_description`. But if your column is called something else entirely (like `startup_name`), the code won't find it.

**Common mismatches to check:**

- Code expects `name` → your column might be `company_name`
- Code expects `description` → your column might be `company_description`
- Code expects `keywords` → your column might be `tracked_keywords`
- Code expects `competitors` → your column might be `competitor_list`

If there's a mismatch, update the profile loading logic in `lib/company-context.ts`.

### Check 2.3: Does the ai_outputs table exist?

```sql
select count(*) from ai_outputs;
```

**If you get "relation ai_outputs does not exist"**: Apply migrations in `supabase/migrations/` (especially `006_ai_outputs.sql` and `007_ai_outputs_metadata.sql`), or create a compatible table:

```sql
create table ai_outputs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  content jsonb not null default '{}',
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table ai_outputs enable row level security;

-- Policies should match your app; see migration files for the exact policies this repo uses.
```

---

## Phase 3: Does the Inngest serve endpoint work?

### Check 3.1: Local dev server

Start your app in one terminal:

```bash
npm run dev
```

Then in another terminal, check the serve endpoint:

```bash
curl http://localhost:3000/api/inngest
```

**Expected output**: JSON with your app info, including a list of functions.
Something like:

```json
{
  "message": "Inngest endpoint configured correctly.",
  "hasEventKey": false,
  "hasSigningKey": false,
  "functionsFound": 10
}
```

**If you get 404**: The route file doesn't exist at `app/api/inngest/route.ts`
**If you get 500**: There's a code error. Check your terminal running `npm run dev` for the error message.
**If functionsFound is 0**: The functions aren't being imported in `route.ts`. Check the imports.

### Check 3.2: Inngest dev server sees your functions

Start the Inngest dev server (this repo has a shortcut):

```bash
npm run inngest:dev
```

Pass your app URL if prompted, or:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Open **http://localhost:8288** in your browser.

**Click the Functions tab.**

**Expected**: You see your functions listed, including (names from this codebase):

- **CBS: Daily Brief Fan-Out** (`cbs-daily-brief-fanout`)
- **CBS: Zazu Daily Brief** (`cbs-daily-brief`)
- **CRO: Job Scan Fan-Out**, **CRO: Job Board Scanner**, **CRO: Lead Outreach**
- **CMO: Content Engine**, **CMO: Comment Engine**, **CMO: Relationship Tracker**
- **CTO: Tech Radar**, **CTO: Platform Poster**
- **Juno ping** (`juno-ping`)

**If no functions appear**: The dev server can't reach your app. Check:

- Is your Next.js app running on port 3000?
- Did you pass the right URL with `-u`?
- Check the dev server terminal for error messages.

**If some functions are missing**: There's an import error in one of the function files. Check your Next.js terminal for compilation errors.

### Check 3.3: Inngest on Vercel (production)

After deploying, go to **app.inngest.com** (Inngest Cloud dashboard).

Click **Apps** in the sidebar. You should see your app listed.

**If your app doesn't appear**: The sync failed. Go to Apps > Sync New App and enter your production URL: `https://your-app.vercel.app/api/inngest`

**If it shows but with errors**: Click into it — Inngest will tell you what's wrong (usually missing signing key or a code error).

---

## Phase 4: Test ONE function end-to-end

Don't try to fix everything at once. Test the simplest possible flow.

### Check 4.1: Get your user ID

You need your Supabase user UUID. Find it:

```sql
select id, email from auth.users limit 5;
```

Or in Supabase dashboard: **Authentication > Users** > copy your user's UUID.

### Check 4.2: Test the daily brief locally

With both your app and Inngest dev server running:

**Option A — from the Inngest dashboard:**

1. Go to http://localhost:8288
2. Click Functions > **"CBS: Zazu Daily Brief"**
3. Click **Invoke**
4. Paste this payload:

```json
{
  "name": "juno/brief.requested",
  "data": {
    "userId": "YOUR_UUID_HERE"
  }
}
```

5. Click Invoke

**Option B — from curl:**

```bash
curl -X POST http://localhost:3000/api/juno/trigger-daily-brief \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"YOUR_UUID_HERE\"}"
```

(`INNGEST_EVENT_KEY` must be set for the API route to send events — see `app/api/juno/trigger-daily-brief/route.ts`.)

### Check 4.3: Watch what happens

Go to the Inngest dashboard (localhost:8288) > **Runs** tab.

You should see a run appear. Click into it.

**The timeline shows each step.** This is where you find what's broken (from `lib/inngest/functions/cbs/daily-brief.ts`):

| Step | What it does | Common failure |
|------|-------------|----------------|
| `load-context` | Reads `company_profile` + assets via `getCompanyContext` | No row / wrong userId → context missing; brief may skip with placeholder |
| `scrape-arxiv` | Calls ArXiv API | Timeout = ArXiv is slow (normal, retries handle it) |
| `scrape-hn` | Calls HN API | Rarely fails |
| `scrape-news` | Fetches RSS feeds | Some feeds may 403 — non-fatal |
| `scrape-ph` | Product Hunt | May rate-limit occasionally |
| `scrape-regulation` | Regulation scrape | Depends on sources configured |
| `score-items` | Calls Claude to score | **401** = `ANTHROPIC_API_KEY` wrong. **Rate limit** = too many calls |
| `format-brief` | Pure formatting | Should rarely fail |
| `save-to-db` | Writes via `saveBriefToDB` | Permission / missing table |
| `send-whatsapp` | Twilio via `sendWhatsAppToUser` | OK to fail if WhatsApp isn't verified — check logs |

**The step that turns red is your problem.** Click it to see the error message.

### Check 4.4: Common errors and fixes

**"No company profile" / skipped brief**

→ Your `userId` is wrong, or `company_profile` is empty for that user.

→ Fix: Ensure the UUID matches a row in `company_profile`.

**"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"**

→ Env vars aren't set in `.env.local`

→ Fix: Add them.

**Anthropic 401 error in score-items**

→ `ANTHROPIC_API_KEY` is missing or wrong

→ Fix: Check the key at console.anthropic.com

**"relation ai_outputs does not exist"**

→ Table doesn't exist

→ Fix: Run migrations from Phase 2 Check 2.3

**Step succeeds but returns empty results (0 items scraped)**

→ Keywords are empty. The scrapers use keywords from your company profile (with fallbacks).

→ Fix: Add keywords to your `company_profile` row.

**"Cannot find module" errors**

→ A file is missing or an import path is wrong

→ Fix: Run the file check from Phase 0.

---

## Phase 5: Test on production (Vercel)

### Check 5.1: Deploy

```bash
git add -A
git commit -m "Add Juno agent functions"
git push
```

Wait for Vercel to build. **Check the Vercel deployment logs for build errors.**

### Check 5.2: Verify the serve endpoint is live

```bash
curl https://your-app.vercel.app/api/inngest
```

Should return JSON with function list, similar to the local check.

### Check 5.3: Check Inngest Cloud sync

Go to **app.inngest.com > Apps**. Your app should show as synced with all functions.

If not synced: Click **Sync New App** and enter `https://your-app.vercel.app/api/inngest`

### Check 5.4: Trigger from production

```bash
curl -X POST https://your-app.vercel.app/api/juno/trigger-daily-brief \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"YOUR_UUID_HERE\"}"
```

Then go to **app.inngest.com > Runs** and watch the execution.

The same step-by-step timeline applies as in Phase 4. Click any red step to see the error.

---

## Phase 6: Verify each agent independently

Once the daily brief works, test the chain:

### CBS → CMO chain

The daily brief emits `juno/brief.generated`. The content engine should auto-trigger.

In the Inngest dashboard, after a successful brief run:

1. Go to **Events** tab
2. Look for `juno/brief.generated`
3. It should show the CMO content engine was triggered

**If the event exists but CMO didn't trigger**: The function trigger doesn't match. In this repo, `lib/inngest/functions/cmo/content-engine.ts` uses `{ event: "juno/brief.generated" }` (imported via `cmo-content-engine.ts`).

### CRO lead scanner

Trigger it directly:

```json
{
  "name": "juno/jobs.scan.requested",
  "data": {
    "userId": "YOUR_UUID_HERE"
  }
}
```

### CTO tech radar

This runs on cron in production, but you can invoke it manually from the Inngest dashboard. Platform poster is tied to `juno/content.approved` in this codebase.

---

## Quick reference: What to check based on symptoms

| Symptom | Check |
|---------|-------|
| Nothing happens at all | Phase 1 (env vars) + Phase 3 (serve endpoint) |
| Build fails | Phase 0 (missing files or packages) |
| Function starts but first step fails | Phase 2 (database) — usually missing profile |
| Scraping works but scoring fails | Phase 1 (`ANTHROPIC_API_KEY`) |
| Everything works but nothing saves | Phase 2 Check 2.3 (`ai_outputs` table) |
| Brief works but CMO doesn't trigger | Phase 6 (event chain) |
| WhatsApp doesn't send | Expected if Twilio / verified number isn't configured — non-blocking for brief DB save |
| Works locally but not on Vercel | Phase 5 (Vercel env vars are separate from `.env.local`) |
| "Function not found" in Inngest | Phase 3 (serve endpoint not registering functions) |

---

## The nuclear option: start with the smallest possible test

If everything feels broken, strip it down to the absolute minimum.

This repo already includes a minimal function: **`lib/inngest/functions/ping.ts`**

- **Event:** `juno/ping`
- **Function id:** `juno-ping`
- **Display name:** Juno ping

It is exported as `junoPing` and included in `inngestFunctions` in `lib/inngest/functions/index.ts`.

**Invoke from the Inngest dev UI** with:

```json
{ "name": "juno/ping", "data": {} }
```

**If this works**: Inngest wiring is fine. The problem is in agent code or data.

**If this doesn't work**: The problem is infrastructure (env vars, serve endpoint, deployment).

Work outward from there.
