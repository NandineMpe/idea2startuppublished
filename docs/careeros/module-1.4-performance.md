# Module 1.4 — Performance benchmarks

**Status: BLOCKED — do not use for curriculum sign-off.**

Targets from rubric (production, realistic volume ≥100 synthetic profiles where noted):

| Query | Target p95 | Actual | Notes |
|-------|--------------|--------|-------|
| Single-user skill graph fetch | <50ms | — | |
| Vector similarity within one user | <100ms | — | Requires embeddings + index warm |
| Vector similarity across users (service role) | <500ms top-100 | — | |
| Profile completeness aggregate | <200ms | — | |

## Environment

- Database region:
- Dataset size (users / skills / embeddings):
- Measurement date:

## Blockers

- Embedding pipeline not deployed; benchmarks are not meaningful until `user_skill_embeddings` is populated at scale.
