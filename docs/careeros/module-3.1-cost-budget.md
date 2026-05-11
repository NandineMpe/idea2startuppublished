# Module 3.1 Cost Budget

Status: feed-source hardening deployed to production; module completion still pending final operational checks.

## Latest deployment snapshot

- Commit: `5348871` ("Stabilize CareerOS feed source adapters")
- Production alias: `https://usejuno-ai.com`
- Build verification: local `npm run build` pass + Vercel production build pass
- Runtime verification: live adapter smoke checks returned items across feed sources (including Mistral recovery from zero-result state)

## Feed-source hardening delivered

- Fixed dead/brittle adapters for:
  - Anthropic
  - Meta AI
  - Mistral
  - EleutherAI
  - DeepMind
  - Papers with Code
  - Hacker News
  - GitHub Trending
  - Microsoft Research
  - Pragmatic Engineer
- Added reusable HTML-link ingestion for sources without stable RSS feeds.
- Added arXiv pagination with required `3s` inter-page throttling.
- Normalized noisy titles so feed cards do not surface SVG/date/category artifacts.
- Added ping-window metadata; arXiv verification now uses `96h` window to handle Monday/weekend publication gaps.

## Sign-off checklist (do not mark complete yet)

- [x] Feed-source adapter hardening deployed to production.
- [x] Production alias verified (`usejuno-ai.com`).
- [ ] Production Inngest runs validated for sustained scheduler health.
- [ ] Production diagnostic verification completed and archived.
- [ ] Feed populated for test users using production pipeline.
- [ ] Manual note-quality review completed on generated user feed notes.

Estimated daily run-rate (early stage):

| Item | Count/day | Cost |
|---|---:|---:|
| arXiv API calls | ~10 | $0 |
| RSS/scrape fetches | ~50 | $0 |
| Qwen enrichment calls | ~1000 | ~$8 |
| OpenAI embeddings (`text-embedding-3-small`) | ~1000 | ~$0.50 |
| Qwen personalisation calls | ~5000 | ~$25 |
| **Daily total** |  | **~$33.50** |
| **Monthly total** |  | **~$1000** |

Notes:

- Spend scales primarily with personalised-note volume.
- Base relevance threshold (`0.55`) is now policy-adjusted by role family, seniority, and engagement.
- Revisit this budget when active users exceed 1000.

## Module 3.1 Hardening Policy (v2)

### Personalisation policy controls

- **Strict irrelevance hard negatives:** Each user is mapped to a role family from role title + ONET SOC + active skills. Each item is classified to a primary function with confidence. High-confidence function mismatches are force-dropped unless a strict override condition is met (very high significance + overlap + margin above threshold).
- **Weekly quota controller:** Rolling 7-day quota now enforces `max 5` items/user. Under-floor path supports `min 3` target by allowing a controlled lower threshold only while the user is below floor.
- **Serving metadata:** Persisted feed rows now include `serving_policy` metadata and reason codes (`served_under_floor_backfill` / `served_under_standard_threshold`) for diagnostics and future policy tuning.

### Adaptive threshold hook

- Deterministic `adaptiveThreshold(segment, engagementSignals)` hook is now enabled.
- Segment key format: `<role_family>:<seniority>`.
- Inputs used: open/read rate, dismiss rate, save rate (where available).
- Output is written into serving metadata and run diagnostics to enable future tuning without ML retraining.

### Spend telemetry and alerting

- Verify feed endpoint now reports:
  - token/cost by workflow (`enrich`, `personalise`)
  - token/cost by coarse user segment (`source_attribution.user_segment`)
  - alert flags when spend exceeds `2x` configured 24h baseline
- Current baseline constants (24h): total `$20`, enrich `$6`, personalise `$14`.

### Source yield + SLA evidence

- Ingestion run stats now capture per-source errors, source coverage matrix, and source yield score.
- Verify feed endpoint now includes scheduled-run evidence over 7-day lookback:
  - expected vs observed completed runs
  - missed run counts
  - at-risk/on-track status flags
  - personalisation filter reason code distribution

### Persona quality verification harness

- Script: `npm run careeros:feed:verify:personas`
- Produces machine-readable summary: `tmp/careeros-feed-persona-verification.json`
- Coverage:
  - relevance precision
  - irrelevance false-positive rate
  - tone checks for alarmist language
  - weekly count target band (3-5)
