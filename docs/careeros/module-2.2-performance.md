# Module 2.2 — Performance Notes

Status: baseline implementation complete; production benchmarks pending.

## Targets

- Cached user salary lookup (`getSalaryBandsForUser`) p95: **< 100ms**
- Verify route (`/api/careeros/_verify/salary-bands`) p95: **< 300ms** for default limits
- Weekly refresh duration: depends on `MARKET_SALARY_MAX_COMBOS_PER_RUN` and source quotas

## Benchmark checklist (production)

1. Trigger salary refresh:
   - `npm run careeros:salary:refresh`
2. Record Inngest run wall-clock for:
   - 1 combo
   - 50 combos
   - full grid slice
3. Measure API timings from deployed URL:
   - `/api/careeros/market/salary`
   - `/api/careeros/_verify/salary-bands?token=...&user_id=...`
4. Capture source mix:
   - count of rows where `source_attribution.is_partial = true`

## Notes

- Adzuna daily quota and JSearch plan quotas dominate throughput planning.
- Refresh is intentionally cache-first and idempotent through upsert conflict keys.
