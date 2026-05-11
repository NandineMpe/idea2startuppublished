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
| `jsearch` | `careeros/market.refresh-demand`, `careeros/market.refresh-salary` (Phase 2) |
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

## Module 2.2 salary composition

- Primary cache table: `careeros.market_salary_bands` (shared cache, not per-user materialisation).
- Refresh workflow: `careeros/market.refresh-salary`.
- Source composition rule (`salary-band-v1`):
  - salary samples from Adzuna + JSearch
  - blended percentile envelope (p15/p50/p85)
  - converted into `junior`, `mid`, `senior` ranges via deterministic multipliers
- Source attribution:
  - persisted in `source_attribution` JSONB on each salary row
  - includes source status, sample sizes, partial-data flag, and caveats
- Caveat:
  - salary bands are not cost-of-living normalised across countries; interpret with region context.

## Module 2.3 skill-velocity normalisation

### Canonical skill keys

- Shared canonical system across resume extraction (`careeros.user_skills`) and market velocity (`careeros.market_skill_velocity`).
- Format: lowercase + hyphenated slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- Examples:
  - `Go`, `golang` -> `go`
  - `JavaScript`, `JS` -> `javascript`
  - `TypeScript`, `TS` -> `typescript`
  - `Model Context Protocol`, `MCP` -> `mcp`

### Synonyms table

- Table: `careeros.skill_synonyms`
- Columns: `synonym_key`, `canonical_skill_key`, `confidence`, `source`, timestamps
- Purpose: collapse lexical variants into one canonical signal before velocity aggregation.

### Skill granularity examples

| Input mention | Canonical key | Rule |
|---|---|---|
| `python-3.12` | `python` | version collapse |
| `python3` | `python` | variant collapse |
| `aws lambda` | `aws-lambda` | lexical normalisation |
| `react server components` | `react-server-components` | keep distinct sub-skill |
| `ml` | `machine-learning` | acronym expansion |
| `llm` | `large-language-models` | acronym expansion |
| `rag` | `retrieval-augmented-generation` | acronym expansion |
| `mcp servers` | `mcp` | concept collapse |
| `quick books` | `quickbooks` | typo/spacing normalisation |
| `k8s` | `kubernetes` | alias normalisation |

### Skill velocity windows

- `M90`, `M180`, `M360`, `M720` (rolling)
- Velocity formula:
  - `velocity_score = ((current_mentions - prior_mentions) / prior_mentions) * 100`
  - If `prior_mentions <= 0`, set `direction = 'new'` and `velocity_score = 0`.

### Noise suppression rules

- minimum mention count in current window: `50`
- minimum absolute increase for strong-growth surfacing: `100`
- minimum growth % for strong-growth surfacing: `25%`
- outlier employer cap: no single employer contributes more than `15%` of mentions for a surfaced skill

### Source composition (Module 2.3)

| Region type | Primary posting sources | Notes |
|---|---|---|
| US | TheirStack + Adzuna | TheirStack usually richer for deep skill mention text; Adzuna broadens sample |
| UK/IE/EU | TheirStack + Adzuna | Region-level mapping uses shared `region_code` mapping from demand/salary modules |
| GLOBAL | Derived aggregate | computed from region-level rows; not fetched as direct vendor region |
