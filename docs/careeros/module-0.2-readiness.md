# CareerOS Module 0.2 Readiness

This checklist tracks external data source credential readiness for Module 0.2.

## Automated smoke script

From the repo root (loads `.env.local`, `.env`, then overrides from `.env.vercel.preview` and `.env.vercel.production` if those files exist):

```bash
npm run careeros:smoke:apis
```

No secrets are printed — only HTTP status and short error snippets.

## Inngest — market cache refresh (O\*NET, rate-paced)

The function **`careeros-market-cache-refresh`** is registered on `app/api/inngest/careeros`. It:

- Runs on a **weekly** cron (`0 3 * * 0`, Sunday 03:00 UTC) and on event **`careeros/cache.refresh`**.
- Probes O\*NET occupation search for one or more keywords; between probes it uses **`step.sleep`** with **`careerosMinIntervalMs("onet")`** from `lib/careeros/integrations/rate-limits.ts` (durable pacing, not raw `setTimeout` in the handler loop).

Manual send (requires `INNGEST_EVENT_KEY` in the environment):

```bash
npm run careeros:cache:refresh
npm run careeros:cache:refresh -- "software developer" "registered nurse"
```

HTTP calls live in `lib/careeros/integrations/onet-request.ts`. Persisting rows into `careeros.onet_*_cache` tables can be added in the same `step.run` blocks when ingestion is ready.

## Vercel in Cursor

Use the **Vercel** integration in Cursor as the primary way to confirm this project is linked and that variables exist for **Development**, **Preview**, and **Production** as needed. The CLI commands below remain valid when you want a local `.env` file for `npm run careeros:smoke:apis`; the plugin and dashboard are the source of truth for what is deployed.

## Vercel environments vs local pulls

`vercel env pull .env.local` defaults to the **Development** environment. CareerOS keys are often added only to **Preview** and **Production**. Until each key exists under **Development** as well, pulls will look empty locally.

Use either:

```bash
vercel env pull .env.vercel.preview --environment preview --yes
vercel env pull .env.vercel.production --environment production --yes
npm run careeros:smoke:apis
```

or add the same variables to Development and then `vercel env pull .env.local`.

## Variable naming (aligned with Vercel dashboard)

| Source | Preferred variables | Notes |
| --- | --- | --- |
| O*NET | `ONET_USERNAME`, `ONET_PASSWORD` | Basic auth; alternative: `ONET_API_KEY` with empty password (`curl -u "$ONET_API_KEY:"`). |
| CareerOneStop | `CAREERONESTOP_USER_ID`, `CAREERONESTOP_API_TOKEN` | Path includes user id; `Authorization: Bearer` token. Not the old single-key path shortcut. |
| Adzuna | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Both required. |
| BLS | `BLS_API_KEY` | Registration key in JSON POST body. |
| Levels.fyi | `LEVELSFYI_API_KEY` or `LEVELS_API_KEY`, optional `LEVELSFYI_API_BASE_URL` | Official REST host/path comes from Levels onboarding — set base URL for automated HTTP probe. |

## Last verification run (automated)

Run date: 2026-05-09 (workspace pull). **Re-run** `npm run careeros:smoke:apis` after you finish adding variables in Vercel and pull (or export) locally — update the table below when green.

Earlier pull snapshot: Preview file once showed empty CareerOS values while other keys decrypted; if that recurs, re-save secrets for that environment or pull **Production** instead.

| Source | Result | Notes |
| --- | --- | --- |
| O*NET | Blocked | `ONET_USERNAME` / `ONET_PASSWORD` empty in pulled Preview file |
| CareerOneStop | Blocked | `CAREERONESTOP_*` empty in pulled Preview file |
| Adzuna | Blocked | Missing `ADZUNA_APP_ID` in env inventory |
| BLS | Blocked | `BLS_API_KEY` empty in pulled Preview file |
| Levels.fyi | Blocked | No `LEVELSFYI_*` / `LEVELS_*` in pulled Preview file |

Re-run `npm run careeros:smoke:apis` after fixing the above; update this table when all sources show `PASS`.

## Minimum target to mark Module 0.2 done

Phase 1–2 keys live and smoke-tested:

- O*NET (`ONET_*`)
- CareerOneStop (`CAREERONESTOP_*`)
- `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`
- `JSEARCH_API_KEY`
- `THEIRSTACK_API_KEY`
- Levels (`LEVELSFYI_*` or alias + optional base URL)
- `BLS_API_KEY`

## Add keys to Vercel

Run for each missing key (repeat per environment you need):

```bash
vercel env add <KEY_NAME> production
vercel env add <KEY_NAME> preview
vercel env add <KEY_NAME> development
```

## Pull to local after updates

```bash
vercel env pull .env.local
# Or preview/production-specific files (see above).
```

## API registration links

Use these direct links to register/request access for each source:

- O*NET Web Services: [https://services.onetcenter.org/developer/](https://services.onetcenter.org/developer/)
- CareerOneStop API: [https://api.careeronestop.org/](https://api.careeronestop.org/)
- Adzuna API: [https://developer.adzuna.com/](https://developer.adzuna.com/)
- JSearch (RapidAPI): [https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
- TheirStack API: [https://theirstack.com/](https://theirstack.com/) (request API access via sales/contact)
- Levels.fyi: [https://www.levels.fyi/api-access/](https://www.levels.fyi/api-access/)
- BLS API: [https://www.bls.gov/developers/](https://www.bls.gov/developers/)
- Eurostat API (no key): [https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access)
- CSO Ireland API (no key): [https://www.cso.ie/en/statistics/webapi/](https://www.cso.ie/en/statistics/webapi/)
- Crunchbase API: [https://data.crunchbase.com/](https://data.crunchbase.com/)
- SEC EDGAR APIs: [https://www.sec.gov/search-filings/edgar-application-programming-interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- Layoffs.fyi dataset: [https://layoffs.fyi/](https://layoffs.fyi/)
- arXiv API: [https://info.arxiv.org/help/api/](https://info.arxiv.org/help/api/)
- Coursera for Partners/Affiliates: [https://www.coursera.org/partnerships](https://www.coursera.org/partnerships)
- Udemy Affiliates (Rakuten): [https://www.rakutenadvertising.com/advertisers/udemy/](https://www.rakutenadvertising.com/advertisers/udemy/)
- Pluralsight (business/contact): [https://www.pluralsight.com/business/contact](https://www.pluralsight.com/business/contact)
- DataCamp for Business/contact: [https://www.datacamp.com/business](https://www.datacamp.com/business)
- edX API/info: [https://www.edx.org/](https://www.edx.org/) (API/discovery access depends on programme agreement)

## Smoke tests (manual `curl`)

Prefer `npm run careeros:smoke:apis` so naming matches this repo.

### O*NET

```bash
curl -u "$ONET_USERNAME:$ONET_PASSWORD" "https://services.onetcenter.org/ws/online/occupations?keyword=software"
```

Or API key as username with empty password:

```bash
curl -u "$ONET_API_KEY:" "https://services.onetcenter.org/ws/online/occupations?keyword=software"
```

### CareerOneStop

Bearer token plus user id in the path ([overview](https://api.careeronestop.org/)):

```bash
curl -H "Authorization: Bearer $CAREERONESTOP_API_TOKEN" \
  "https://api.careeronestop.org/v1/occupation/$CAREERONESTOP_USER_ID/Software%20Developer/94107/25"
```

### Adzuna

```bash
curl "https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=$ADZUNA_APP_ID&app_key=$ADZUNA_APP_KEY&results_per_page=1&what=software%20engineer"
```

### JSearch (RapidAPI)

```bash
curl -H "X-RapidAPI-Key: $JSEARCH_API_KEY" -H "X-RapidAPI-Host: jsearch.p.rapidapi.com" "https://jsearch.p.rapidapi.com/search?query=software%20engineer&page=1&num_pages=1"
```

### TheirStack

```bash
curl -H "Authorization: Bearer $THEIRSTACK_API_KEY" "https://api.theirstack.com/v1/jobs?limit=1"
```

### BLS

```bash
curl -H "Content-type: application/json" -d "{\"seriesid\":[\"OEU0000000000000151252000\"],\"registrationkey\":\"$BLS_API_KEY\"}" "https://api.bls.gov/publicAPI/v2/timeseries/data/"
```

### Levels.fyi

Use the REST base URL and auth scheme from your Levels onboarding email. Set `LEVELSFYI_API_BASE_URL` for the automated smoke script, or confirm manually once and note the probe URL here.

## Definition of done (Module 0.2)

- All Phase 1–2 keys added in Vercel for the environments you use (including **Development** if you rely on `vercel env pull .env.local`)
- `.env.local` or `.env.vercel.preview` / `.env.vercel.production` contains non-empty values after pull
- `npm run careeros:smoke:apis` reports `PASS` for each integrated source
- Source limits documented in the table below (keep in sync with vendor pages as they change)

### Source limits & published quotas

Use this table for **Inngest cron spacing**, **cache refresh batching**, and **429/backoff** design. A TypeScript mirror of the defaults lives at `lib/careeros/integrations/rate-limits.ts` (`careerosMinIntervalMs`, `delayForCareerOsVendor`, profiles per vendor) — **update both** when vendor terms change. Where a vendor publishes only daily caps, spread calls across the day; where both per-second and per-day apply, **both** are enforced (whichever you hit first).

| Source | Published limits (summary) | Primary reference | CareerOS target (default) |
| --- | --- | --- | --- |
| **O*NET Web Services** | Throttling if you exceed **5 requests/second** **or** **50,000 requests/day** (per credentials). | [O*NET Terms of Service](https://services.onetcenter.org/terms) | Cap at **4 req/s** and **45k calls/day** with headroom; cache taxonomy & occupation payloads aggressively. |
| **CareerOneStop** | No public numeric cap found in open developer pages; fair-use / best-effort implied. | [Web APIs hub](https://www.careeronestop.org/Developers/WebAPI/web-api.aspx) | Default **≤1 req/s** burst, **exponential backoff** on 429/5xx; **session cache** for repeated occupation lookups. |
| **Adzuna** | Default access: **25 hits/minute**, **250/day**, **1,000/week**, **2,500/month**. Higher tiers by agreement. | [Adzuna API Terms](https://developer.adzuna.com/docs/terms_of_service) | Stay under **20/min** and **220/day** for margin; align bulk pulls with weekly/monthly ceilings. |
| **JSearch (RapidAPI)** | **Plan-specific** (e.g. free BASIC tiers are often **low monthly** quotas — confirm current RapidAPI pricing page). | [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) | Read quota from your subscription UI; schedule jobs **below** the stated monthly max; **single-flight** refresh jobs. |
| **TheirStack** | **Jobs / Companies / Technographics** (shared): **Free** — 4/s, 10/min, 50/hour, 400/day; **Paid** — **4/s** (paid removes daily/min/hour caps per docs). **429** when exceeded; **RateLimit-*** headers returned. | [TheirStack rate limits](https://theirstack.com/en/docs/api-reference/rate-limit) | Respect headers when implemented; cap workers at **3/s** free tier; backoff on **429**. |
| **BLS Public Data API v2** | Registered key: **500 queries/day**; **50 requests per 10 seconds**; up to **50 series** per query (v2). Unauthenticated legacy limits lower — always use a **registration key**. | [BLS API features](https://www.bls.gov/developers/api_features.htm), [FAQ](https://www.bls.gov/developers/api_faqs.htm) | ≤**45 queries/day** budget per integration slice if sharing the key; batch **series IDs** (≤50) per POST; pace to stay under **50/10s**. |
| **Levels.fyi** | **Contract-specific** (enterprise / API programme); not a single public number. | [API access](https://www.levels.fyi/api-access/) | Follow your agreement; default **≤2 req/s** until vendor confirms; cache compensation snapshots. |
| **Eurostat API** | Statistical disclosure service — generally **fair use**; avoid sustained high parallelism; follow Eurostat contact guidance for heavy use. | [Eurostat API — data access](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access) | **≤4 concurrent** connections where applicable; throttle bulk pulls off-peak. |
| **CSO Ireland (PxWeb API)** | Fair use; large extracts may need coordination with CSO. | [CSO PxWeb](https://www.cso.ie/en/statistics/webapi/) | Treat like Eurostat: moderate concurrency, cache published tables. |
| **Crunchbase** | **Tier/plan-specific** request quotas. | [Crunchbase Data API](https://data.crunchbase.com/) | Observe dashboard quota + **429**; exponential backoff. |
| **SEC EDGAR** | **10 requests/second** per guidance for bulk/script access (user-agent required); additional fair-access expectations. | [SEC APIs / fair access](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | Cap at **≤8 req/s**; identify User-Agent per SEC rules; cache filings metadata. |
| **Layoffs.fyi** | Dataset / page usage — respect site terms and robots; no standard REST quota. | [Layoffs.fyi](https://layoffs.fyi/) | Manual or scheduled light scraping only if permitted; prefer **static dumps** if offered. |
| **arXiv API** | Rate limits apply **in aggregate** across your infrastructure; do not distribute across machines to evade; contact for higher throughput. Guidelines often cite modest bursts with pauses (see bulk-access docs). | [arXiv API terms](https://info.arxiv.org/help/api/tou.html), [bulk data](https://info.arxiv.org/help/bulk_data.html) | **≤1 req/s** sustained with backoff; prefer **bulk exports** for large corpora. |
| **Coursera / Udemy / Pluralsight / DataCamp / edX** | **Partner / affiliate / enterprise** agreements only — quotas set per contract. | Vendor partnership pages (see registration links above) | No automated pulls until commercial terms exist; design **batch + cache** once quota is known. |

**Operational notes**

- Retry **429** and **5xx** with **exponential backoff + jitter**; never tight-loop on failure.
- Prefer **shared-cache tables** (already in the CareerOS schema) so user traffic does not multiply vendor calls.
- Revisit this table **quarterly** or when a vendor emails policy changes.
