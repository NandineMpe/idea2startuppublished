# CareerOS Schema Contracts

This document defines cross-cutting schema contracts used by CareerOS workers and migrations.

## input_data_version

`input_data_version` is a SHA-256 hash of a canonical JSON snapshot of generation inputs.

### Canonicalisation rules

- UTF-8 encoding
- Object keys sorted lexicographically at every level
- Null fields included explicitly
- Timestamps normalised to ISO 8601 UTC format
- Numeric values normalised to deterministic decimal strings
- Arrays sorted only where order is non-semantic; otherwise preserved

### Stored format

- Lowercase hex string (64 chars)

## Generation payload scrubbing (GDPR pseudonymisation)

On account deletion, `careeros.generation_runs` rows are pseudonymised by:

- setting `user_id = null`
- retaining non-reversible hashes (`input_hash`, `output_hash`)
- scrubbing JSON fields to safe whitelists

### Safe field whitelist by artefact type

The whitelist controls which keys survive in `source_attribution` and `error_payload`.

#### `user_document_extractions`

- `workflow_name`
- `parser_name`
- `parser_version`
- `schema_version`
- `status_code`
- `error_class`

#### `user_skill_embeddings`

- `workflow_name`
- `embedding_model`
- `embedding_dim`
- `schema_version`
- `status_code`
- `error_class`

#### `user_adjacent_role_snapshots`

- `workflow_name`
- `market_dataset_version`
- `ranking_method`
- `schema_version`
- `status_code`
- `error_class`

#### `user_market_briefings`

- `workflow_name`
- `briefing_schema_version`
- `market_dataset_version`
- `region_code`
- `status_code`
- `error_class`

#### `user_career_health_reports`

- `workflow_name`
- `report_schema_version`
- `model_version`
- `prompt_version`
- `status_code`
- `error_class`

#### `user_ai_feed_items`

- `workflow_name`
- `feed_type`
- `model_version`
- `prompt_version`
- `status_code`
- `error_class`

#### `user_skill_half_life`

- `workflow_name`
- `method_version`
- `schema_version`
- `status_code`
- `error_class`

#### `user_narrative_documents`

- `workflow_name`
- `narrative_type`
- `model_version`
- `prompt_version`
- `status_code`
- `error_class`

#### `user_generated_outputs`

- `workflow_name`
- `output_type`
- `model_version`
- `prompt_version`
- `status_code`
- `error_class`

Any key outside the whitelist must be removed during pseudonymisation.

## Market briefing payload envelope (v1)

`careeros.user_market_briefings.briefing_payload` is a strict typed envelope.

```json
{
  "schema_version": 1,
  "generated_at": "2026-05-09T00:00:00Z",
  "region_code": "IE-D",
  "sections": {
    "where_you_stand": {},
    "demand_trajectory": {},
    "salary_bands": {},
    "skill_velocity_personal": {},
    "adjacent_roles_summary": {}
  },
  "source_freshness": {
    "onet": "2026-05-09T00:00:00Z",
    "adzuna": "2026-05-09T00:00:00Z",
    "theirstack": "2026-05-09T00:00:00Z",
    "bls": "2026-05-09T00:00:00Z",
    "levelsfyi": "2026-05-09T00:00:00Z"
  }
}
```

When any section schema changes, bump `schema_version`. Old rows are retained for audit and naturally age out of current reads.
