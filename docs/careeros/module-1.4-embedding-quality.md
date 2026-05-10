# Module 1.4 — Embedding quality (cosine sanity)

**Status: BLOCKED — do not use for curriculum sign-off.**

Expected ordering (same model, real vectors):

| Pair | Expected similarity band |
|------|---------------------------|
| “Python” vs “Python programming” | > 0.85 |
| “Python” vs “Java” | 0.5 – 0.75 |
| “Python” vs “Excel” | < 0.5 |
| “Python” vs “Marketing strategy” | < 0.3 |
| Self vs self | ~1.0 |

## Measurements

Run against production `user_skill_embeddings` after the embedding workflow ships. Record anchor phrases and cosine values here.

| Comparison | Cosine | Pass? |
|------------|--------|-------|
| | | |

## Blockers

- No embeddings written by workers yet — Section 4.1 must complete first.
