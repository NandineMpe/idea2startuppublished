# Module 2.4 — Adjacent Roles Engine

Module 2.4 builds an adjacent-role cache and a user-personalized read path that ranks nearby role options from market similarity signals.

## Implemented steps

1. **Dataset version + scoring engine**
   - `lib/careeros/market/adjacent-version.ts`
   - `lib/careeros/market/adjacent-roles.ts`
   - Scoring combines:
     - SOC family proximity (same 2-digit family)
     - demand similarity (`market_demand_trajectories`, `M360`)
     - salary similarity (`market_salary_bands`, `mid`)
   - Writes to `careeros.market_adjacent_roles` with dataset `adjacent-roles-v1`.

2. **Refresh workflow**
   - Inngest function: `careeros-market-refresh-adjacent-roles`
   - Triggers:
     - cron: `TZ=UTC 0 15 * * 0`
     - event: `careeros/market.refresh-adjacent-roles`
   - Registered in `app/api/inngest/careeros/route.ts`.

3. **User read path + snapshots**
   - `getAdjacentRolesForUser(userId)` in `lib/careeros/market/adjacent-roles.ts`
   - Loads user `onet_soc_code`, reads adjacent-role cache, then persists:
     - `user_adjacent_role_snapshots`
     - `user_adjacent_role_items`
   - Returns `ready`, `cache_miss`, or `profile_incomplete`.

4. **User API route**
   - `GET /api/careeros/market/adjacent-roles`

5. **Verify route**
   - `GET /api/careeros/_verify/adjacent-roles?token=...&user_id=...`
   - Returns cache health, sample rows, sample user query, and recent refresh runs.

6. **UI exposure**
   - `app/(careeros)/careeros/market/page.tsx`
   - Adds **Adjacent Roles** card showing top ranked transitions and fit score.

7. **Manual trigger script**
   - `npm run careeros:adjacent-roles:refresh`
   - Optional SOC list args:
     - `npm run careeros:adjacent-roles:refresh -- 15-1252.00 13-1111.00`
