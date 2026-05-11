# Module 1.2 Edge Cases

This document records tested behaviour for the current `profile-extract@1.0.0` pipeline.

## Empty LinkedIn paste

- Fixture: `recent-grad-pm` with LinkedIn removed.
- Behaviour: extraction runs from resume-only input, no LinkedIn-specific skills generated.
- Intended rule: do not fabricate LinkedIn data.

## Empty resume

- Fixture: `freelancer-designer` with resume removed.
- Behaviour: extraction runs from LinkedIn-only input.
- Intended rule: do not fabricate resume data.

## Resume in non-English language

- Fixture: ad-hoc manual test (Spanish resume snippet).
- Behaviour: extraction returns fields it can map and leaves uncertain fields sparse.
- Intended rule: extract what is available, never crash.

## Very long resume (5+ pages)

- Fixture: ad-hoc synthetic long profile.
- Behaviour: extraction completes with truncated prompt input and still returns schema-valid object.
- Intended rule: prioritize schema validity and avoid failure due to length.

## Very short resume (<200 words)

- Fixture: `recent-grad-pm` minimal variant.
- Behaviour: sparse output with limited skills and roles.
- Intended rule: return sparse-but-valid output, no hallucination.

## Resume with no skills section

- Fixture: `non-tech-marketing` variant without explicit skills list.
- Behaviour: skills derived from role descriptions when direct evidence exists.
- Intended rule: only extract evidenced skills.

## Conflicting resume vs LinkedIn dates/roles

- Fixture: ad-hoc conflict variant.
- Behaviour: resume wins for role/date conflicts; skill list merges both sources and deduplicates by `canonical_skill_key`.
- Intended rule: resume is the source-of-truth tiebreaker for chronology.
