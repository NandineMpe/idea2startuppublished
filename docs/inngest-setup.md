# Enable Inngest (cron + event chains)

You already have **`/api/inngest`** and a **`juno/ping`** function. To turn it on in **dev** and **production**, do the following.

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

Add these in **Vercel → Project → Settings → Environment Variables** for **Production** (and **Preview** if you want previews to register functions).

### Local (`.env.local`)

```env
# Same signing key as dev in Inngest, OR use the dev server flow below
INNGEST_SIGNING_KEY=your_signing_key_here

# Optional — only if you call inngest.send() from the app
# INNGEST_EVENT_KEY=...
```

**Do not commit** real keys. Keep `.env.local` gitignored.

---

## 3. Deploy a public URL

Inngest must reach:

`https://<your-domain>/api/inngest`

1. Deploy to Vercel (or your host) with env vars set.
2. In **Inngest Dashboard → Apps → your app → Sync / URL**, ensure the **production URL** matches your deployment (Inngest often auto-detects after first successful sync).

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

Point the dev server at your local app URL (often `http://localhost:3000`). Trigger **`juno/ping`** from the Inngest UI against the dev app.

Optional: `package.json` script:

```json
"inngest:dev": "npx inngest-cli@latest dev"
```

---

## 7. Add a cron (next step)

In `lib/inngest/functions.ts`, register a function with a **cron** trigger, e.g.:

```ts
triggers: [{ cron: "0 7 * * *" }], // 07:00 UTC daily — adjust TZ needs via Inngest or schedule
```

Export it in `inngestFunctions` and redeploy. See [Inngest cron](https://www.inngest.com/docs/guides/scheduled-functions) for timezone options.

---

## Checklist summary

- [ ] Inngest account + app created  
- [ ] `INNGEST_SIGNING_KEY` in Vercel (Production)  
- [ ] Deploy so `/api/inngest` is public  
- [ ] Middleware allows `/api/inngest` without session  
- [ ] Functions visible in Inngest dashboard  
- [ ] `juno/ping` test run succeeds  
- [ ] (Optional) `inngest-cli dev` for local  
- [ ] Add cron function when ready  

---

## References

- Architecture: `docs/architecture-agentic-inngest.md`  
- Code: `lib/inngest/client.ts`, `lib/inngest/functions.ts`, `app/api/inngest/route.ts`
