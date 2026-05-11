# Module 2.1 — O\*NET occupation cache (market intelligence kickoff)

Module **2.1** is the first slice of **Phase 2 / Module 2** market intelligence: persist O\*NET **keyword search** results into `careeros.onet_occupations_cache` so downstream flows (diagnostics, mappings, briefings) share one authoritative SOC→title cache.

## Curriculum steps (implementation)

1. **Schema** — `careeros.onet_occupations_cache` exists (`careeros_20260509_phase2_market_intelligence.sql`).
2. **Ingestion** — `careeros-market-cache-refresh` (`careeros/cache.refresh` cron + event) calls `fetchOnetKeywordSearchDetailed`, then `upsertOnetOccupationsFromKeywordProbe` per keyword step (`lib/careeros/market/onet-occupation-cache.ts`).
3. **Versioning** — rows keyed by `(onet_soc_code, onet_release)`. Set release via **`ONET_DATA_RELEASE`** or **`ONET_RELEASE`** (default `28.3` in code if unset).
4. **Service role** — ensure `careeros_20260511_service_role_grants_postgrest.sql` (or equivalent GRANTs) is applied so `SUPABASE_SERVICE_ROLE_KEY` can upsert.
5. **Verify** — `GET /api/careeros/_verify/onet-occupation-cache?token=$VERIFY_TOKEN` returns `total_rows` and a `sample` of recent rows.
6. **Inngest** — `skillsEmbed` is registered on `app/api/inngest/careeros` (embeddings are Module 1.4+; registration is required for a complete CareerOS bundle).

## Manual run

```bash
npm run careeros:cache:refresh
# or with keywords:
npm run careeros:cache:refresh -- "data scientist" "registered nurse"
```

## Sign-off checklist

- [ ] O\*NET credentials present on the target environment (`ONET_API_KEY` and/or `ONET_USERNAME` + `ONET_PASSWORD`).
- [ ] At least one `careeros/cache.refresh` run completes with `upserted > 0` in Inngest output (or `total_rows` increases on the verify route).
- [ ] `GET …/onet-occupation-cache` returns `ok: true` and non-zero `total_rows` after a successful run.

## Out of scope for 2.1

- `onet_skills_cache`, demand/salary/velocity tables, user market briefings (later Module 2.x).
- Non-O\*NET sources (Adzuna, BLS, etc.) — see Module 0.2 / data-sources map.
