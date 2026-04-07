# Enable Inngest (cron + event chains)

You already have **`/api/inngest`** and registered functions under **`lib/inngest/functions/`** (not only **`juno/ping`** — CBS/CRO/CMO pipelines too). Use the steps below for **dev** and **production**.

---

## 0. Vercel + Inngest (official integration)

If you used **Vercel → Integrations → Inngest** and connected this project:

- Inngest can **wire env** into Vercel so production **`https://<your-domain>/api/inngest`** syncs after deploy.
- You may still add **`INNGEST_EVENT_KEY`** in Vercel if the app calls **`inngest.send()`** (e.g. **`POST /api/juno/trigger-daily-brief`**). Cron + **`step.sendEvent`** inside functions do not need it.

**If functions don’t appear or sync fails:**

- **Deployment Protection** on preview URLs can block Inngest — see [Inngest + Vercel](https://www.inngest.com/docs/deploy/vercel) (disable protection for the URL Inngest calls, or use production).
- Confirm **`/api/inngest`** returns **200** without a logged-in user (this repo **allows** that path in middleware).

**Docs vs this repo:** Inngest’s guide may use **`src/inngest/functions.ts`** and **`@inngest/functions`**. We use **`lib/inngest/client.ts`**, **`lib/inngest/functions/index.ts`**, and **`app/api/inngest/route.ts`** — same pattern, different import paths.

---

## 1. Create an Inngest app

1. Go to [Inngest](https://www.inngest.com/) and sign in.
2. Create an **app** (name can match `idea2startup` from `lib/inngest/client.ts`).
3. Open the app’s **Manage** / **Keys** (wording varies by UI version).

---

## 2. Environment variables

### Production (e.g. Vercel)

| Variable | Required? | Purpose |
|----------|------------|---------|
| **`INNGEST_SIGNING_KEY`** | **Yes** | Inngest Cloud authenticates requests to your `serve` endpoint. Copy **Production** signing key from the dashboard. |
| **`INNGEST_EVENT_KEY`** | Optional | Only if your **Next.js app** sends events with `inngest.send()` (e.g. from API routes). Cron + `step.sendEvent` inside functions do **not** require this. |

With the **Vercel integration**, many values are handled for you; add any missing keys under **Vercel → Project → Settings → Environment Variables** (Production / Preview as needed).

### Local (`.env.local`)

```env
# Same signing key as dev in Inngest, OR use the dev server flow below
INNGEST_SIGNING_KEY=your_signing_key_here

# Required for POST /api/juno/trigger-daily-brief (manual daily brief)
INNGEST_EVENT_KEY=your_event_key_here

# Single-user testing for cron fan-out (no listUsers)
JUNO_TEST_USER_ID=<supabase-auth-user-uuid>

# Twilio (shared sender) — per-user destination is stored in company_profile (Settings → WhatsApp)
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

**Do not commit** real keys. Keep `.env.local` gitignored.

---

## 3. Deploy a public URL

Inngest must reach:

`https://<your-domain>/api/inngest`

1. Deploy to Vercel (or your host) with env vars set.
2. In **Inngest Dashboard → Apps → your app → Sync / URL**, ensure the **production URL** matches your deployment (Inngest often auto-detects after first successful sync).

### CLI / terminal sync (activates crons + function registry)

After each deploy (or if the dashboard shows stale functions), **PUT** your serve endpoint. Inngest Cloud picks up function definitions including **cron** triggers.

**Production example** (use `curl.exe` on Windows so PowerShell doesn’t alias `curl`):

```bash
curl.exe -X PUT "https://idea2startuppublished.vercel.app/api/inngest" --fail-with-body
```

Success looks like: `{"message":"Successfully registered","modified":true}` and HTTP **200**.

Requires **`INNGEST_SIGNING_KEY`** on Vercel so the handler matches your Inngest **environment** (Production vs Dev).

If sync fails, check:

- Route exists: `GET/POST/PUT` on `/api/inngest` (already in repo).
- **No auth middleware** blocking `/api/inngest` — if `middleware.ts` protects everything except static files, **exclude** `/api/inngest` from redirect-to-login, or Inngest cannot register functions.

---

## 4. Middleware check (important)

Your `middleware.ts` should **not** require a login for `/api/inngest` (Inngest Cloud calls it with signing keys, not user cookies).

This repo **allows** `/api/inngest` early (skips session work) — see `lib/supabase/middleware.ts`. If you change middleware, keep that path public.

---

## 5. Verify in the Inngest UI

1. After deploy, open **Functions** — you should see **`juno-ping`**.
2. Use **Invoke** / **Send test event** with name **`juno/ping`** and `{}` data — run should succeed.

---

## 6. Local development

Run the **Inngest Dev Server** so local runs appear in the UI:

```bash
npx inngest-cli@latest dev
```

In another terminal:

```bash
npm run dev
```

Point the dev server at your local app URL (often `http://localhost:3000`).

**Invoke locally:** open **`http://127.0.0.1:8288/functions`** (Inngest Dev Server UI) → find a function (e.g. **`juno-ping`**) → **Invoke**. Runs appear in the **Runs** view with step-by-step progress — same pattern as Inngest’s getting-started **`hello-world`** flow.

You can also send test events from the dashboard (e.g. event name **`juno/ping`** with `{}` data).

This repo includes **`npm run inngest:dev`** → `npx inngest-cli@latest dev`.

---

## 7. Add a cron (next step)

In **`lib/inngest/functions/`**, add a function with a **cron** trigger (Inngest **v4** shape):

```ts
inngest.createFunction(
  {
    id: "my-cron-fn",
    triggers: [{ cron: "0 7 * * *" }], // 07:00 UTC — adjust as needed
  },
  async ({ step }) => { /* ... */ },
)
```

Register it in **`lib/inngest/functions/index.ts`** (`inngestFunctions` array) and redeploy. See [Inngest scheduled functions](https://www.inngest.com/docs/guides/scheduled-functions).

---

## 8. Workflow definition vs Inngest CLI

- **What Inngest actually runs:** TypeScript functions under **`lib/inngest/functions/`**, exported from **`lib/inngest/functions/index.ts`**, registered by **`serve()`** in **`app/api/inngest/route.ts`**. Cron schedules, events, and `step.run` names live there. After deploy, Inngest Cloud **syncs** from your public **`/api/inngest`** (Vercel integration or `PUT` as above).
- **What the CLI is for:** **`npm run inngest:dev`** runs **`npx inngest-cli dev`**, the **Inngest Dev Server** (often UI at `http://127.0.0.1:8288`). Use it to **invoke and debug** runs against local Next. It does **not** replace writing workflow code in `.ts` files; there is no separate “CLI workflow file” that ships instead of this repo’s functions.

## 9. Reddit customer research (behavioral updates)

**Functions:** **`cro-intent-scan-fanout`** (cron) → emits **`juno/intent.scan.requested`** per user → **`cro-intent-scanner`**.

**Schedule:** **`15 */4 * * *`** (UTC): every **4 hours** at minute 15.

**Behavior:** Load company context → **resolve subreddits** (saved `reddit_intent_subreddits`, else LLM suggestion merged with defaults) → **scan Reddit** → score → **`intent_signals`** → **LLM synthesis** (push/pull/anxiety themes, next moves) → **`ai_outputs`** (`tool: behavioral_updates`) for the dashboard.

**Manual run:** **`POST /api/intelligence/trigger`** with body **`{ "pipeline": "intent" }`** (needs **`INNGEST_EVENT_KEY`** on the server).

**Code:** **`lib/inngest/functions/cro/intent-scanner.ts`**, subreddit resolution **`lib/juno/reddit-subreddit-suggest.ts`**.

---

## Checklist summary

- [ ] Inngest account + app; **Vercel integration** connected (or env vars set manually)  
- [ ] Production deploy; **`/api/inngest`** reachable; **Deployment Protection** not blocking sync  
- [ ] Middleware allows `/api/inngest` without session  
- [ ] Functions visible in Inngest dashboard (CBS/CRO/CMO + **`juno-ping`**)  
- [ ] **`juno/ping`** test run succeeds (cloud or local **8288**)  
- [ ] `INNGEST_EVENT_KEY` in Vercel if you use **`POST /api/juno/trigger-daily-brief`**  

---

## References

- Architecture: `docs/architecture-agentic-inngest.md`  
- Juno pipelines: `docs/juno-project-guide.md`  
- Code: `lib/inngest/client.ts`, `lib/inngest/functions/index.ts`, `app/api/inngest/route.ts`  
- Inngest + Vercel: [Deploy to Vercel](https://www.inngest.com/docs/deploy/vercel) (official)
