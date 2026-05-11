# Module 3.2 — Exposure Score Seed: Documentation

## Overview

The file `data/careeros/exposure-scores-v1.json` contains 200 canonical skill entries with AI displacement exposure scores. These are loaded into `careeros.skill_ai_exposure_scores` via `scripts/careeros/seed-exposure-scores.ts`.

The seed is the baseline for Module 3.2 half-life computation. Skills not present in the seed fall back to `exposure_score = 0.5` (medium exposure) and are queued for Qwen inference by the `exposureScoreRefresh` function.

---

## Methodology

Scores are assigned on a 0.0–1.0 scale representing the probability of AI displacement within 5 years, drawing from:

1. **Eloundou et al. (2023)** — Task-level GPT-4 exposure analysis. Each occupation's tasks were assessed for LLM substitutability. Canonical skill keys are mapped to the task categories in this paper.

2. **McKinsey Skill Change Index (2024)** — Tracks changes in skill demand across 800+ occupations. Used particularly for business, sales, and administrative skills where the Eloundou task-level analysis is less granular.

3. **Manual scores** — Applied to skills with clear market discontinuities (e.g. Adobe Flash, Silverlight, IE development) that have definitive end-of-life dates.

---

## Category Breakdown (200 seeds)

| Category | Count | Score Range | Description |
|---|---|---|---|
| `augmenting` | ~17 | 0.00–0.10 | Skills that grow in value as AI expands |
| `low` | ~80 | 0.10–0.30 | Deep expertise, hard to substitute |
| `medium` | ~70 | 0.30–0.58 | Partially AI-augmentable |
| `high` | ~33 | 0.60–0.90 | Routine tasks, high displacement risk |

---

## How to Update

### Adding new skills

1. Add entries to `data/careeros/exposure-scores-v1.json` with the following structure:
```json
{
  "canonical_skill_key": "skill-name-hyphenated",
  "exposure_score": 0.25,
  "exposure_category": "low",
  "source": "eloundou_2023",
  "rationale": "One or two sentences explaining the score."
}
```

2. Re-run the seed script:
```bash
npx tsx scripts/careeros/seed-exposure-scores.ts
```

The script is idempotent — it upserts on `canonical_skill_key`.

### Updating existing scores

Edit the entry in `data/careeros/exposure-scores-v1.json` and re-run the seed script. The `updated_at` column will be updated via the database trigger.

### Automated inference for new skills

The `exposureScoreRefresh` Inngest function runs quarterly (cron: `0 0 1 */3 *`). It:
1. Finds skills in `market_skill_velocity` that have no entry in `skill_ai_exposure_scores`
2. Calls Qwen to infer a score using `lib/careeros/prompts/exposure-inference.v1.ts`
3. Inserts with `source = "qwen_inference_v1"` and `methodology_version = "v1"`

Inferred scores should be reviewed by a human and optionally promoted to `source = "manual"` after review.

---

## Augmenting Skills (17 entries)

These skills are scored at 0.05 (very low displacement risk) and category `augmenting`:

- prompt-engineering, ai-orchestration, llm-evaluation, ai-safety, ml-ops
- ai-product-management, retrieval-augmented-generation, vector-databases
- ai-policy, responsible-ai, ai-alignment, fine-tuning, model-evaluation
- agent-systems, ai-infrastructure, prompt-injection-defense, ai-red-teaming

Augmenting skills receive special handling in the half-life formula: they always trend toward `rising` unless market demand is actively declining.

---

## Source Files

- Seed data: `data/careeros/exposure-scores-v1.json`
- Seed script: `scripts/careeros/seed-exposure-scores.ts`
- Inference prompt: `lib/careeros/prompts/exposure-inference.v1.ts`
- DB table: `careeros.skill_ai_exposure_scores`
