# CareerOS Content Flywheel

Module 3.1 intentionally reuses one intelligence pipeline for two outputs:

1. User-facing personalised feed (`/careeros/feed`)
2. Creator-facing high-significance topic queue for short-form content

## Flow

1. Ingest raw feed items (`careeros.feed_source_items`)
2. Enrich with structured signal + significance (`careeros.feed_items_enriched`)
3. Personalise for users (`careeros.user_ai_feed_items`)
4. Pull top-significance global items for content:
   - `GET /api/careeros/_verify/feed/top-significance?token=...`

## TikTok script handoff

For each top-significance item:

- Use `title` + `enriched_summary` for hook/context
- Use `entities.capabilities` for "what changed"
- Use `affected_functions`/`affected_skills` for "who should care"
- Keep tone factual, no hype, no fear language
