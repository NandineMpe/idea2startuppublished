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

## 8) Role trajectory view (Module 2.2 + 2.4 combined)

**Goal:** Turn “should I switch titles?” into a quantitative, per-target comparison using cached salary bands, adjacent targets, and bridge skills.

**Where it lives**

- Model constants and pure math: `lib/careeros/market/adjacent-trajectory-model.ts` (`TRAJECTORY_MODEL_VERSION`)
- Data assembly (batch salary bands, user learning hours from `user_settings.onboarding_state.learning_hours_per_week`, profile seniority): `lib/careeros/market/adjacent-trajectory.ts` — `buildAdjacentRoleTrajectoryPack`
- Adjacent read path now exposes `source_salary_mid`, `target_salary_mid`, `source_demand_delta_pct`, `target_demand_delta_pct`, `bridge_skill_count` on each ready item: `lib/careeros/market/adjacent-roles.ts`
- UI: `components/careeros/adjacent-role-trajectory-card.tsx` (per-target **Trajectory** tabs on Market)

**Inputs (curriculum alignment)**

| Input | Source |
| --- | --- |
| Current vs target salary band (same seniority) | `market_salary_bands` (Module 2.2) for source SOC, target SOC, user region |
| 12-month pay growth signal (both roles) | Heuristic: base merit % + tilt from `market_demand_trajectories` M360 `demand_delta_pct` (posting momentum, **not** a wage index). Labelled as “implied annual pay growth (12m window model)” in UI |
| Bridge skill gap | Module 2.4 bridge list (`inferTargetRoleSkills` minus user `user_skills`) |
| Bridge calendar time | `bridge_skill_count × HOURS_PER_BRIDGE_SKILL ÷ learning_hours_per_week`, with a floor when the gap is empty |
| Implied return on switch | Excess geometric CAGR of the 3-year **ending compensation** under switch vs stay (see model file) |

**Outputs**

- Per adjacent role (top six): stay path year-3 comp, bridge weeks/months, switch path year-3 comp, band min/max where available, implied growth % for each side, excess CAGR vs stay.

**Honesty bar**

- Copy must not claim BLS or employer-reported raises; growth is modelled from posting deltas plus a fixed base curve.
- If the user has no baseline comp (no `current_salary_usd` and no usable band mid), the trajectory card is omitted.
