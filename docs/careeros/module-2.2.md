# Module 2.2 — Salary Band Engine

Module 2.2 builds a shared market cache in `careeros.market_salary_bands` and a user-facing read path that returns salary ranges by seniority for the user's role + region.

## Implemented steps

1. **Workflow registration**
   - Inngest function: `careeros-market-refresh-salary`
   - Triggers:
     - cron: `30 2 * * 0` (weekly)
     - event: `careeros/market.refresh-salary`
   - Registered in `app/api/inngest/careeros/route.ts`.

2. **Source adapters**
   - `lib/careeros/integrations/adzuna-salary-samples.ts`
   - `lib/careeros/integrations/jsearch-salary-samples.ts`
   - Both return normalised salary sample arrays and status metadata.

3. **Composition + cache write**
   - `lib/careeros/market/salary-bands.ts`
   - Composition rule:
     - blend Adzuna + JSearch annual salary samples
     - compute percentile envelope (p15 / p50 / p85) as base band
     - derive `junior`, `mid`, `senior` bands via multipliers
   - Upsert target:
     - `careeros.market_salary_bands`
     - conflict key: `(onet_soc_code, seniority_band, region_code, source_dataset_version)`
   - Dataset version: `salary-band-v1`.

4. **User read path**
   - `getSalaryBandsForUser(userId)` returns:
     - `ready` with salary bands
     - `profile_incomplete`
     - `cache_miss` (queues targeted `careeros/market.refresh-salary`)
   - API endpoint:
     - `GET /api/careeros/market/salary`

5. **User-visible page**
   - `app/(careeros)/careeros/market/page.tsx`
   - Displays factual salary bands with source caveats (no predictive claims).

6. **Verification route**
   - `GET /api/careeros/_verify/salary-bands?token=...&user_id=...`
   - Returns cache health, sample query, and recent refresh runs.

7. **Manual ops trigger**
   - `npm run careeros:salary:refresh`
   - Optional:
     - `--soc <onet_soc_code>`
     - `--region <region_code>`
     - `--max-combos <n>`

## Required operational checks before sign-off

- Ensure `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` and `JSEARCH_API_KEY` (or `RAPIDAPI_KEY`) are present in Vercel.
- Ensure service-role grants are applied for shared cache tables (see `careeros_20260511_service_role_grants_postgrest.sql`).
- Run a refresh and confirm `market_salary_bands` row count increases.
- Confirm `/api/careeros/_verify/salary-bands` returns healthy cache metadata.
