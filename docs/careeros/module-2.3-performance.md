# Module 2.3 — Skill Velocity Performance

Status: implementation complete; production long-run benchmarks pending after full refresh.

## Targets

- Top rising skills globally: `< 100ms p95`
- Single skill cross-region query: `< 100ms p95`
- Personal skill-velocity cut: `< 200ms p95`
- Region movers query: `< 150ms p95`

## Current query paths

- `getTopRisingSkillsGlobal(window, limit)` in `lib/careeros/market/skill-velocity.ts`
- `getTopDecliningSkillsGlobal(window, limit)` in `lib/careeros/market/skill-velocity.ts`
- `getPersonalSkillVelocityForUser(userId, window)` in `lib/careeros/market/skill-velocity.ts`

## Benchmark procedure (production)

1. Trigger refresh: `npm run careeros:skill-velocity:refresh`
2. Wait for Inngest run completion
3. Measure verify route and app route latency on deployed URLs
4. Record p50/p95 from repeated calls (n>=50) per query path

## Cost controls

- Batch extraction with Qwen
- Dedupe postings by `(employer, title, day)`
- Threshold-based suppression to avoid ranking on tiny samples
- Shared cache table (`market_skill_velocity`) to keep per-user reads fast
