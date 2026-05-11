# Module 2.4 — Adjacent Roles Performance

Status: implementation complete; production refresh benchmarks pending.

## Targets

- Cache refresh throughput: `>= 50 source SOCs` per run
- User adjacent-role query: `< 250ms p95`
- Verify route health query: `< 300ms p95`

## Current query paths

- `refreshMarketAdjacentRoles()` in `lib/careeros/market/adjacent-roles.ts`
- `getAdjacentRolesForUser(userId)` in `lib/careeros/market/adjacent-roles.ts`
- `/api/careeros/_verify/adjacent-roles`

## Benchmark procedure (production)

1. Trigger refresh: `npm run careeros:adjacent-roles:refresh`
2. Wait for Inngest completion
3. Hit verify route and user route repeatedly (`n>=30`)
4. Record p50/p95 latencies and row growth for `market_adjacent_roles`
