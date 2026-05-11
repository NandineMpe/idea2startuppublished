# Module 2.3 — Skill Velocity Quality Report

Status: baseline implementation in place; manual validation checklist below.

## Extraction quality protocol

- Sample: 50 random postings per refresh cohort
- Manual baseline: human-labelled required skills
- Metrics:
  - Precision target: `>= 0.85`
  - Recall target: `>= 0.75`

## Ground-truth spot check list

Known-rising candidates to track:
- `mcp`
- `agentic-ai`
- `retrieval-augmented-generation`
- `llmops`
- `vector-databases`

Known-declining candidates to track:
- `jquery`
- `flash`
- `perl`
- `backbone-js`
- `soap`

## Noise checks

- Verify no top mover with `mention_count < 50`
- Verify no mover dominated by one employer (`>15%` share)
- Verify `new` direction appears only when prior mention count is null/zero

## Stability check

- Re-run same refresh config twice over near-identical data window
- Compare top-20 rising/declining lists
- Significant drift should be investigated as extraction inconsistency or source volatility
