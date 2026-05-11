# Career Health Report — quality rubric

## Automated gate (required before claiming “5 personas pass”)

Runs deterministic checks on **structured inputs + mock narrative** aligned to the five `test/careeros/fixtures/profiles/*` personas (synthetic market blocks, not live DB pulls):

```bash
npm run careeros:verify:health
```

The script asserts:

- Six pillars, scores in `0..100`, summaries present
- Composite equals the mean of pillar scores (tolerance 1 point)
- Narrative matches the shared Zod schema (length limits, 3–5 actions, unique priorities)
- No em dash (`U+2014`) in user-facing fields
- No blocked vocabulary from `lib/copy-writing-rules.ts` (subset enforced in code)
- Headline includes the rounded composite score (shareable artefact consistency)

## Human pass (still required for “production quality review”)

Skim each persona’s **live** report once Qwen is wired (or read `report_payload` from staging):

1. **Tone:** Sounds like one person, not a template stack. Short beats, no lecture voice.
2. **Grounding:** Numbers in prose match `pillar_scores` and composite (no invented deltas).
3. **Layoff:** If `layoff.status` is `phase_4_employer_not_resolved` or `not_linked`, copy should not imply employer-specific risk.
4. **Actions:** Each item is doable in a week and maps to the stated `related_pillar`.
5. **Gaps:** Missing salary or demand cache called out once, then the brief moves on.

Sign-off: note date, environment, and who reviewed in your release checklist.
