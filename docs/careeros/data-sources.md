# CareerOS Data Sources

## Summary table

| Provider | Phase | Auth pattern | Env vars | Status | Adapter file |
|---|---|---|---|---|---|
| O*NET | 1 | Basic (user+pass) | `ONET_USERNAME`, `ONET_PASSWORD` | Live | `lib/careeros/sources/onet.ts` |
| CareerOneStop | 2 | Bearer | `CAREERONESTOP_USER_ID`, `CAREERONESTOP_API_TOKEN` | Live | `lib/careeros/sources/careeronestop.ts` |
| Adzuna | 2 | Query params | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Live | `lib/careeros/sources/adzuna.ts` |
| JSearch | 2 | RapidAPI headers | `RAPIDAPI_KEY` | Live | `lib/careeros/sources/jsearch.ts` |
| BLS | 2 | Key in POST body | `BLS_API_KEY` | Live | `lib/careeros/sources/bls.ts` |
| Eurostat | 2 | None | — | Live | `lib/careeros/sources/eurostat.ts` |
| CSO Ireland | 2 | None | — | Live | `lib/careeros/sources/cso-ireland.ts` |
| Levels.fyi (public) | 2 | None | — | Live | `lib/careeros/sources/levelsfyi.ts` |
| SEC EDGAR | 4 | User-Agent header | `SEC_EDGAR_USER_AGENT` | Live | `lib/careeros/sources/sec-edgar.ts` |
| arXiv | 3 | None | — | Live | `lib/careeros/sources/arxiv.ts` |
| Layoffs.fyi | 4 | None (Kaggle dataset) | — | Stubbed | `lib/careeros/sources/layoffs-fyi.ts` |
| TheirStack | 2 | Bearer | `THEIRSTACK_API_KEY` | Awaiting sales (contact sent 2026-05-10) | — |
| Crunchbase | 4 | API key | `CRUNCHBASE_API_KEY` | Deferred (Phase 4) | — |
| Coursera | 5 | Affiliate/partner ID | `COURSERA_AFFILIATE_ID` | Deferred (Phase 5) | — |
| Udemy | 5 | Affiliate ID | `UDEMY_AFFILIATE_ID` | Deferred (Phase 5) | — |
| Pluralsight | 5 | Affiliate ID | `PLURALSIGHT_AFFILIATE_ID` | Deferred (Phase 5) | — |
| DataCamp | 5 | Affiliate ID | `DATACAMP_AFFILIATE_ID` | Deferred (Phase 5) | — |
| edX | 5 | Partner/affiliate access | `EDX_AFFILIATE_ID` | Deferred (Phase 5) | — |

## Per-provider rate limits

| Provider | Limit | Window | Notes |
|---|---|---|---|
| O*NET | Guidance: 5 req/sec, 50k/day | rolling + daily | Track vendor TOS and keep pacing in integration helpers. |
| CareerOneStop | Unspecified | — | Use conservative pacing and cache aggressively. |
| Adzuna | 25 req/min; 250/day (default dev tier) | minute + daily | Confirm plan-specific limits in dashboard. |
| JSearch (RapidAPI) | Plan-specific | monthly | Bound by subscription tier. |
| BLS | 500 req/day with registration key | daily | Use series batching to reduce calls. |
| Eurostat | Fair use | — | Avoid high concurrency; cache responses. |
| CSO Ireland | Fair use | — | Keep calls moderate and cache datasets. |
| Levels.fyi public .md | Unspecified | — | Treat as fair use; cache markdown snapshots. |
| SEC EDGAR | 10 req/sec | rolling | User-Agent with contact is mandatory. |
| arXiv | 1 req per 3 sec recommended | rolling | Respect API terms; throttle client calls. |

## Per-provider quirks

### O*NET
- Uses HTTP Basic auth for current CareerOS implementation (`ONET_USERNAME` + `ONET_PASSWORD`).
- Include `Accept: application/json` for JSON responses.
- Occupation identifiers are O*NET-SOC codes (for example, `15-1252.00`).

### CareerOneStop
- `userId` is part of the URL path and token is `Authorization: Bearer ...`.
- Occupation endpoint pattern in this module: `/v1/occupation/{userId}/{keyword}/{location}`.

### Adzuna
- Authentication uses query params (`app_id`, `app_key`) instead of headers.
- Country is in the path (`/v1/api/jobs/{country}/search/...`).

### JSearch
- Requires both `X-RapidAPI-Key` and `X-RapidAPI-Host: jsearch.p.rapidapi.com`.
- Subscription must be active in RapidAPI for successful calls.

### BLS
- Endpoint is POST; API key is `registrationkey` in JSON body.
- Series IDs are required and should be centrally curated.

### SEC EDGAR
- No API key, but `User-Agent` with real contact email is required.
- Keep request rate under SEC fair-access limits.

### arXiv
- Response format is Atom XML, not JSON.
- Respect low-rate guidance and add throttling for multi-call jobs.

## Adapter ↔ workflow map

| Adapter | Used by Inngest workflows |
|---|---|
| `onet` | `careeros/profile.onet-map` (Phase 1), `careeros/market.refresh-*` (Phase 2+) |
| `careeronestop` | `careeros/market.refresh-salary` (Phase 2) |
| `adzuna` | `careeros/market.refresh-demand`, `careeros/market.refresh-salary` (Phase 2) |
| `jsearch` | `careeros/market.refresh-demand` (Phase 2) |
| `bls` | `careeros/market.refresh-salary` (Phase 2) |
| `eurostat` | `careeros/market.refresh-salary` (Phase 2) |
| `cso-ireland` | `careeros/market.refresh-salary` (Phase 2) |
| `levelsfyi` | `careeros/market.refresh-salary` (Phase 2) |
| `sec-edgar` | `careeros/company.refresh-public` (Phase 4) |
| `arxiv` | `careeros/feed.ingest` (Phase 3) |
| `layoffs-fyi` | `careeros/company.refresh-layoff-signals` (Phase 4) |

## Verification

Hit the verification route on any deployed environment:

```bash
curl -s "https://<deployment-url>/api/careeros/_verify/sources?token=$VERIFY_TOKEN" | jq .
```

Expected: `"overall": "PASS"` and all adapters report `"ok": true`.
